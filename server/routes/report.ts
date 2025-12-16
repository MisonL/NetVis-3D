import { Hono } from 'hono';
import { db, schema } from '../db';
import { eq, desc, and, gte, lte, count, sql } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';
import * as XLSX from 'xlsx';

const reportRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 获取报表类型列表
reportRoutes.get('/types', authMiddleware, async (c) => {
  try {
    const reportTypes = [
      {
        id: 'device-inventory',
        name: '设备资产报表',
        description: '设备清单、类型分布、状态统计',
        icon: 'desktop',
        formats: ['xlsx', 'pdf', 'csv'],
      },
      {
        id: 'alert-summary',
        name: '告警汇总报表',
        description: '按时间段统计告警数量和处理情况',
        icon: 'bell',
        formats: ['xlsx', 'pdf'],
      },
      {
        id: 'performance-analysis',
        name: '性能分析报表',
        description: 'CPU、内存、流量趋势分析',
        icon: 'line-chart',
        formats: ['xlsx', 'pdf'],
      },
      {
        id: 'audit-log',
        name: '审计日志报表',
        description: '操作记录、登录统计',
        icon: 'file-text',
        formats: ['xlsx', 'csv'],
      },
      {
        id: 'config-change',
        name: '配置变更报表',
        description: '配置备份和下发记录',
        icon: 'setting',
        formats: ['xlsx', 'pdf'],
      },
    ];

    return c.json({
      code: 0,
      data: reportTypes,
    });
  } catch (error) {
    console.error('Get report types error:', error);
    return c.json({ code: 500, message: '获取报表类型失败' }, 500);
  }
});

// 生成设备资产报表
reportRoutes.post('/generate/device-inventory', authMiddleware, async (c) => {
  try {
    const { format = 'json', dateRange } = await c.req.json();

    // 获取设备数据
    const devices = await db.select().from(schema.devices);

    // 按类型统计
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byVendor: Record<string, number> = {};

    devices.forEach(device => {
      byType[device.type] = (byType[device.type] || 0) + 1;
      byStatus[device.status] = (byStatus[device.status] || 0) + 1;
      if (device.vendor) {
        byVendor[device.vendor] = (byVendor[device.vendor] || 0) + 1;
      }
    });

    const reportData = {
      title: '设备资产报表',
      generatedAt: new Date().toISOString(),
      summary: {
        totalDevices: devices.length,
        byType: Object.entries(byType).map(([type, count]) => ({ type, count })),
        byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
        byVendor: Object.entries(byVendor).map(([vendor, count]) => ({ vendor, count })),
      },
      devices: devices.map(d => ({
        name: d.name,
        type: d.type,
        vendor: d.vendor,
        ip: d.ipAddress,
        status: d.status,
        location: d.location,
        createdAt: d.createdAt,
      })),
    };

    if (format === 'csv') {
      // 生成CSV
      const headers = ['设备名称', '类型', '厂商', 'IP地址', '状态', '位置'];
      const rows = reportData.devices.map(d => 
        [d.name, d.type, d.vendor || '', d.ip || '', d.status, d.location || ''].join(',')
      );
      const csv = [headers.join(','), ...rows].join('\n');
      
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="device_inventory_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    if (format === 'xlsx') {
      // 生成Excel
      const workbook = XLSX.utils.book_new();
      
      // 设备清单Sheet
      const deviceData = reportData.devices.map(d => ({
        '设备名称': d.name,
        '类型': d.type,
        '厂商': d.vendor || '',
        'IP地址': d.ip || '',
        '状态': d.status,
        '位置': d.location || '',
        '创建时间': d.createdAt,
      }));
      const deviceSheet = XLSX.utils.json_to_sheet(deviceData);
      XLSX.utils.book_append_sheet(workbook, deviceSheet, '设备清单');
      
      // 统计汇总Sheet
      const summaryData = [
        { '统计项': '设备总数', '数量': reportData.summary.totalDevices },
        { '统计项': '', '数量': '' },
        { '统计项': '== 按类型统计 ==', '数量': '' },
        ...reportData.summary.byType.map(t => ({ '统计项': t.type, '数量': t.count })),
        { '统计项': '', '数量': '' },
        { '统计项': '== 按状态统计 ==', '数量': '' },
        ...reportData.summary.byStatus.map(s => ({ '统计项': s.status, '数量': s.count })),
        { '统计项': '', '数量': '' },
        { '统计项': '== 按厂商统计 ==', '数量': '' },
        ...reportData.summary.byVendor.map(v => ({ '统计项': v.vendor, '数量': v.count })),
      ];
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, '统计汇总');
      
      // 生成Buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      return new Response(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="device_inventory_${new Date().toISOString().split('T')[0]}.xlsx"`,
        },
      });
    }

    return c.json({
      code: 0,
      data: reportData,
    });
  } catch (error) {
    console.error('Generate device inventory report error:', error);
    return c.json({ code: 500, message: '生成设备资产报表失败' }, 500);
  }
});

// 生成告警汇总报表
reportRoutes.post('/generate/alert-summary', authMiddleware, async (c) => {
  try {
    const { startDate, endDate, format = 'json' } = await c.req.json();

    // 获取告警数据
    const alerts = await db.select().from(schema.alerts);

    // 按严重程度统计
    const bySeverity: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    
    alerts.forEach(alert => {
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
      byStatus[alert.status] = (byStatus[alert.status] || 0) + 1;
    });

    // 按日期统计（真实数据）
    const dailyTrendResult = await db.execute(sql`
      SELECT
        to_char(created_at, 'YYYY-MM-DD') as date,
        severity,
        count(*)::int as count
      FROM ${schema.alerts}
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY 1, 2
      ORDER BY 1
    `);

    // 初始化过去7天的数据结构
    const dailyTrendMap = new Map<string, { date: string; critical: number; warning: number; info: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0] as string;
      dailyTrendMap.set(dateStr, { date: dateStr, critical: 0, warning: 0, info: 0 });
    }

    // 填充查询结果
    // @ts-ignore
    const rows = dailyTrendResult.rows || dailyTrendResult;
    rows.forEach((row: any) => {
      const stats = dailyTrendMap.get(row.date as string);
      if (stats && row.severity) {
        (stats as any)[row.severity] = row.count;
      }
    });

    const dailyTrend = Array.from(dailyTrendMap.values());

    // TOP告警设备（真实数据）
    const topDevicesResult = await db.execute(sql`
      SELECT
        d.name as device_name,
        count(*)::int as count
      FROM ${schema.alerts} a
      LEFT JOIN ${schema.devices} d ON a.device_id = d.id
      WHERE a.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY d.name
      ORDER BY count DESC
      LIMIT 10
    `);

    // @ts-ignore
    const topDevicesRows = topDevicesResult.rows || topDevicesResult;
    const topDevices = topDevicesRows.map((row: any) => ({
      device: row.device_name || 'Unknown',
      alertCount: row.count,
    }));

    const reportData = {
      title: '告警汇总报表',
      generatedAt: new Date().toISOString(),
      dateRange: { startDate, endDate },
      summary: {
        totalAlerts: alerts.length,
        bySeverity: Object.entries(bySeverity).map(([severity, count]) => ({ severity, count })),
        byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
        resolveRate: alerts.length > 0 
          ? Math.round((byStatus['resolved'] || 0) / alerts.length * 100) 
          : 0,
      },
      dailyTrend,
      topDevices,
    };

    if (format === 'xlsx') {
      const workbook = XLSX.utils.book_new();
      
      // 告警列表Sheet
      const alertData = alerts.map(a => ({
        '告警消息': a.message,
        '严重程度': a.severity,
        '状态': a.status,
        '设备ID': a.deviceId || '',
        '创建时间': a.createdAt,
      }));
      const alertSheet = XLSX.utils.json_to_sheet(alertData);
      XLSX.utils.book_append_sheet(workbook, alertSheet, '告警列表');
      
      // 统计汇总Sheet
      const summaryData = [
        { '统计项': '告警总数', '数量': reportData.summary.totalAlerts },
        { '统计项': '处理率', '数量': `${reportData.summary.resolveRate}%` },
        { '统计项': '', '数量': '' },
        { '统计项': '== 按严重程度 ==', '数量': '' },
        ...reportData.summary.bySeverity.map(s => ({ '统计项': s.severity, '数量': s.count })),
        { '统计项': '', '数量': '' },
        { '统计项': '== 按状态 ==', '数量': '' },
        ...reportData.summary.byStatus.map((s: any) => ({ '统计项': s.status, '数量': s.count })),
      ];
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, '统计汇总');
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      return new Response(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="alert_summary_${new Date().toISOString().split('T')[0]}.xlsx"`,
        },
      });
    }

    return c.json({
      code: 0,
      data: reportData,
    });
  } catch (error) {
    console.error('Generate alert summary report error:', error);
    return c.json({ code: 500, message: '生成告警汇总报表失败' }, 500);
  }
});

// 生成性能分析报表
reportRoutes.post('/generate/performance-analysis', authMiddleware, async (c) => {
  try {
    const { deviceId, metrics, timeRange } = await c.req.json();

    // 真实性能数据聚合
    const metricsResult = await db.execute(sql`
      SELECT 
        AVG(cpu_usage)::numeric(10,2) as avg_cpu,
        MAX(cpu_usage)::numeric(10,2) as max_cpu,
        AVG(memory_usage)::numeric(10,2) as avg_mem,
        MAX(memory_usage)::numeric(10,2) as max_mem,
        AVG(COALESCE(bytes_in, 0) + COALESCE(bytes_out, 0))::numeric(10,2) as avg_traffic,
        MAX(COALESCE(bytes_in, 0) + COALESCE(bytes_out, 0))::numeric(10,2) as peak_traffic
      FROM ${schema.deviceMetrics}
      WHERE device_id = ${deviceId} 
        AND timestamp >= NOW() - INTERVAL '24 hours'
    `);

    // @ts-ignore
    const m = (metricsResult.rows || metricsResult)[0] || {};
    
    // 趋势数据 (过去24小时每小时均值)
    const trendResult = await db.execute(sql`
      SELECT 
        extract(hour from timestamp) as hour,
        AVG(cpu_usage)::numeric(10,2) as cpu,
        AVG(memory_usage)::numeric(10,2) as memory,
        AVG(COALESCE(bytes_in, 0))::numeric(10,2) as inbound,
        AVG(COALESCE(bytes_out, 0))::numeric(10,2) as outbound
      FROM ${schema.deviceMetrics}
      WHERE device_id = ${deviceId} 
        AND timestamp >= NOW() - INTERVAL '24 hours'
      GROUP BY 1
      ORDER BY 1
    `);

    // @ts-ignore
    const trendRows = trendResult.rows || trendResult;
    const trends = {
      cpu: trendRows.map((r: any) => ({ hour: r.hour, value: Number(r.cpu || 0) })),
      memory: trendRows.map((r: any) => ({ hour: r.hour, value: Number(r.memory || 0) })),
      traffic: trendRows.map((r: any) => ({ 
        hour: r.hour, 
        inbound: Number(r.inbound || 0),
        outbound: Number(r.outbound || 0) 
      })),
    };

    // 生成建议
    const recommendations = [];
    if (Number(m.avg_cpu) > 70) recommendations.push('CPU平均使用率过高，建议排查高负载进程');
    if (Number(m.max_cpu) > 90) recommendations.push('CPU峰值超过90%，存在性能瓶颈风险');
    if (Number(m.avg_mem) > 80) recommendations.push('内存使用率较高，建议考虑扩容');
    if (Number(m.peak_traffic) > 1000 * 1000 * 100) recommendations.push('峰值流量较高，请关注带宽余量'); // >100Mbps
    if (recommendations.length === 0) recommendations.push('各项性能指标正常');

    const performanceData = {
      title: '性能分析报表',
      generatedAt: new Date().toISOString(),
      timeRange,
      summary: {
        avgCpu: Number(m.avg_cpu || 0),
        maxCpu: Number(m.max_cpu || 0),
        avgMemory: Number(m.avg_mem || 0),
        maxMemory: Number(m.max_mem || 0),
        avgTraffic: Math.round(Number(m.avg_traffic || 0) / 1024 / 1024 * 8), // bits -> Mbps (approx)
        peakTraffic: Math.round(Number(m.peak_traffic || 0) / 1024 / 1024 * 8),
      },
      trends,
      recommendations,
    };

    return c.json({
      code: 0,
      data: performanceData,
    });
  } catch (error) {
    console.error('Generate performance analysis report error:', error);
    return c.json({ code: 500, message: '生成性能分析报表失败' }, 500);
  }
});

// 获取报表历史
reportRoutes.get('/history', authMiddleware, async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    const reportTypeNames: Record<string, string> = {
      'device-inventory': '设备资产报表',
      'alert-summary': '告警汇总报表',
      'performance-analysis': '性能分析报表',
      'audit-log': '审计日志报表',
      'config-change': '配置变更报表',
    };

    const history = await db
      .select({
        id: schema.reports.id,
        type: schema.reports.type,
        name: schema.reports.name,
        format: schema.reports.format,
        status: schema.reports.status,
        fileSize: schema.reports.fileSize,
        generatedBy: schema.reports.generatedBy,
        startedAt: schema.reports.startedAt,
        completedAt: schema.reports.completedAt,
        createdAt: schema.reports.createdAt,
      })
      .from(schema.reports)
      .orderBy(desc(schema.reports.createdAt))
      .limit(pageSize)
      .offset(offset);

    const historyWithNames = history.map(h => ({
      ...h,
      typeName: reportTypeNames[h.type] || h.type,
    }));

    const totalResult = await db.select({ total: count() }).from(schema.reports);
    const total = totalResult[0]?.total ?? 0;

    return c.json({
      code: 0,
      data: {
        list: historyWithNames,
        pagination: { page, pageSize, total },
      },
    });
  } catch (error) {
    console.error('Get report history error:', error);
    return c.json({ code: 500, message: '获取报表历史失败' }, 500);
  }
});

// 定时报表配置
reportRoutes.get('/schedules', authMiddleware, async (c) => {
  try {
    // cron表达式描述映射
    const cronDescriptions: Record<string, string> = {
      '0 8 * * *': '每天08:00',
      '0 9 * * 1': '每周一09:00',
      '0 0 1 * *': '每月1日00:00',
    };

    const schedules = await db
      .select({
        id: schema.reportSchedules.id,
        name: schema.reportSchedules.name,
        reportType: schema.reportSchedules.reportType,
        params: schema.reportSchedules.params,
        cron: schema.reportSchedules.cron,
        recipients: schema.reportSchedules.recipients,
        isEnabled: schema.reportSchedules.isEnabled,
        lastRunAt: schema.reportSchedules.lastRunAt,
        nextRunAt: schema.reportSchedules.nextRunAt,
        createdAt: schema.reportSchedules.createdAt,
      })
      .from(schema.reportSchedules)
      .orderBy(desc(schema.reportSchedules.createdAt));

    const schedulesWithDesc = schedules.map(s => ({
      ...s,
      cronDescription: cronDescriptions[s.cron] || s.cron,
    }));

    return c.json({
      code: 0,
      data: schedulesWithDesc,
    });
  } catch (error) {
    console.error('Get report schedules error:', error);
    return c.json({ code: 500, message: '获取定时报表配置失败' }, 500);
  }
});

export { reportRoutes };
