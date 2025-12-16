import { Hono } from 'hono';
import { db, schema } from '../db';
import { count, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const analyticsRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 获取仪表盘统计数据
analyticsRoutes.get('/dashboard', authMiddleware, async (c) => {
  try {
    // 设备统计
    const deviceCount = await db.select({ count: count() }).from(schema.devices);
    
    // 用户统计
    const userCount = await db.select({ count: count() }).from(schema.users);
    
    // 告警统计
    const alertCount = await db.select({ count: count() }).from(schema.alerts);
    
    // 按类型统计设备
    const devicesByType = await db
      .select({
        type: schema.devices.type,
        count: count(),
      })
      .from(schema.devices)
      .groupBy(schema.devices.type);
    
    // 按状态统计设备
    const devicesByStatus = await db
      .select({
        status: schema.devices.status,
        count: count(),
      })
      .from(schema.devices)
      .groupBy(schema.devices.status);
    
    // 按严重程度统计告警
    const alertsBySeverity = await db
      .select({
        severity: schema.alerts.severity,
        count: count(),
      })
      .from(schema.alerts)
      .groupBy(schema.alerts.severity);

    return c.json({
      code: 0,
      data: {
        summary: {
          totalDevices: deviceCount[0]?.count ?? 0,
          totalUsers: userCount[0]?.count ?? 0,
          totalAlerts: alertCount[0]?.count ?? 0,
        },
        devicesByType: devicesByType.map(d => ({
          type: d.type,
          count: Number(d.count),
        })),
        devicesByStatus: devicesByStatus.map(d => ({
          status: d.status,
          count: Number(d.count),
        })),
        alertsBySeverity: alertsBySeverity.map(a => ({
          severity: a.severity,
          count: Number(a.count),
        })),
      },
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    return c.json({ code: 500, message: '获取统计数据失败' }, 500);
  }
});

// 获取设备趋势数据（真实数据）
analyticsRoutes.get('/trends/devices', authMiddleware, async (c) => {
  try {
    // 过去7天的每日设备状态统计
    const trendResult = await db.execute(sql`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) FILTER (WHERE status = 'online') as online,
        COUNT(*) FILTER (WHERE status = 'offline') as offline,
        COUNT(*) FILTER (WHERE status = 'warning') as warning
      FROM ${schema.devices}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 7
    `);
    
    // @ts-ignore
    const dbTrends = ((trendResult.rows || trendResult) as any[]).reverse();
    
    // 如果没有历史数据，查询当前状态作为今天的数据
    if (dbTrends.length === 0) {
      const currentStatus = await db
        .select({
          status: schema.devices.status,
          count: count(),
        })
        .from(schema.devices)
        .groupBy(schema.devices.status);
      
      const statusMap = new Map(currentStatus.map(s => [s.status, Number(s.count)]));
      
      return c.json({
        code: 0,
        data: [{
          date: new Date().toISOString().split('T')[0],
          online: statusMap.get('online') || 0,
          offline: statusMap.get('offline') || 0,
          warning: statusMap.get('warning') || 0,
        }],
      });
    }

    const trends = dbTrends.map((row: any) => ({
      date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date,
      online: Number(row.online || 0),
      offline: Number(row.offline || 0),
      warning: Number(row.warning || 0),
    }));

    return c.json({
      code: 0,
      data: trends,
    });
  } catch (error) {
    console.error('Get device trends error:', error);
    return c.json({ code: 500, message: '获取趋势数据失败' }, 500);
  }
});

// 获取告警趋势数据（真实数据）
analyticsRoutes.get('/trends/alerts', authMiddleware, async (c) => {
  try {
    // 过去7天的每日告警统计
    const trendResult = await db.execute(sql`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical,
        COUNT(*) FILTER (WHERE severity = 'warning') as warning,
        COUNT(*) FILTER (WHERE severity = 'info') as info
      FROM ${schema.alerts}
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);
    
    // @ts-ignore
    const trends = ((trendResult.rows || trendResult) as any[]).map((row: any) => ({
      date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date,
      critical: Number(row.critical || 0),
      warning: Number(row.warning || 0),
      info: Number(row.info || 0),
    }));

    return c.json({
      code: 0,
      data: trends,
    });
  } catch (error) {
    console.error('Get alert trends error:', error);
    return c.json({ code: 500, message: '获取趋势数据失败' }, 500);
  }
});

// 获取流量统计数据（真实数据 - 基于deviceMetrics）
analyticsRoutes.get('/traffic', authMiddleware, async (c) => {
  try {
    // 过去24小时的每小时流量聚合（基于latency作为代理指标，实际应有traffic字段）
    const trafficResult = await db.execute(sql`
      SELECT 
        time_bucket('1 hour', timestamp) as hour,
        SUM(COALESCE(bytes_in, 0))::bigint as inbound,
        SUM(COALESCE(bytes_out, 0))::bigint as outbound
      FROM ${schema.deviceMetrics}
      WHERE timestamp > NOW() - INTERVAL '24 hours'
      GROUP BY hour
      ORDER BY hour ASC
    `);
    
    // @ts-ignore
    const data = ((trafficResult.rows || trafficResult) as any[]).map((row: any) => ({
      time: new Date(row.hour).toISOString().slice(11, 16).replace(':', ':'),
      inbound: Number(row.inbound || 0) / 1024 / 1024, // 转换为MB
      outbound: Number(row.outbound || 0) / 1024 / 1024,
    }));

    const totalInbound = data.reduce((sum, d) => sum + d.inbound, 0);
    const totalOutbound = data.reduce((sum, d) => sum + d.outbound, 0);

    return c.json({
      code: 0,
      data: {
        hourly: data,
        summary: {
          totalInbound: Math.round(totalInbound),
          totalOutbound: Math.round(totalOutbound),
          peakInbound: data.length > 0 ? Math.round(Math.max(...data.map(d => d.inbound))) : 0,
          peakOutbound: data.length > 0 ? Math.round(Math.max(...data.map(d => d.outbound))) : 0,
        },
      },
    });
  } catch (error) {
    console.error('Get traffic stats error:', error);
    return c.json({ code: 500, message: '获取流量数据失败' }, 500);
  }
});

// 获取TOP设备（按CPU/内存/流量）- 真实数据
analyticsRoutes.get('/top-devices', authMiddleware, async (c) => {
  try {
    // TOP 5 by CPU (最近5分钟平均)
    const cpuResult = await db.execute(sql`
      SELECT 
        d.id, d.name, d.ip_address as ip,
        AVG(m.cpu_usage)::numeric(10,2) as value
      FROM ${schema.deviceMetrics} m
      JOIN ${schema.devices} d ON m.device_id = d.id
      WHERE m.timestamp > NOW() - INTERVAL '5 minutes'
      GROUP BY d.id, d.name, d.ip_address
      ORDER BY value DESC
      LIMIT 5
    `);
    // @ts-ignore
    const topByCpu = ((cpuResult.rows || cpuResult) as any[]).map((row: any) => ({
      name: row.name,
      value: Number(row.value || 0),
      ip: row.ip || '-',
    }));

    // TOP 5 by Memory (最近5分钟平均)
    const memResult = await db.execute(sql`
      SELECT 
        d.id, d.name, d.ip_address as ip,
        AVG(m.memory_usage)::numeric(10,2) as value
      FROM ${schema.deviceMetrics} m
      JOIN ${schema.devices} d ON m.device_id = d.id
      WHERE m.timestamp > NOW() - INTERVAL '5 minutes'
      GROUP BY d.id, d.name, d.ip_address
      ORDER BY value DESC
      LIMIT 5
    `);
    // @ts-ignore
    const topByMemory = ((memResult.rows || memResult) as any[]).map((row: any) => ({
      name: row.name,
      value: Number(row.value || 0),
      ip: row.ip || '-',
    }));

    // TOP 5 by Traffic (最近1小时总流量)
    const trafficResult = await db.execute(sql`
      SELECT 
        d.id, d.name, d.ip_address as ip,
        (SUM(COALESCE(m.bytes_in, 0)) + SUM(COALESCE(m.bytes_out, 0)))::bigint as value
      FROM ${schema.deviceMetrics} m
      JOIN ${schema.devices} d ON m.device_id = d.id
      WHERE m.timestamp > NOW() - INTERVAL '1 hour'
      GROUP BY d.id, d.name, d.ip_address
      ORDER BY value DESC
      LIMIT 5
    `);
    // @ts-ignore
    const topByTraffic = ((trafficResult.rows || trafficResult) as any[]).map((row: any) => ({
      name: row.name,
      value: Math.round(Number(row.value || 0) / 1024 / 1024), // MB
      ip: row.ip || '-',
    }));

    return c.json({
      code: 0,
      data: {
        byCpu: topByCpu,
        byMemory: topByMemory,
        byTraffic: topByTraffic,
      },
    });
  } catch (error) {
    console.error('Get top devices error:', error);
    return c.json({ code: 500, message: '获取TOP设备失败' }, 500);
  }
});

export { analyticsRoutes };

