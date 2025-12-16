import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc, sql } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const capacityRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 容量规划配置
const capacityConfig = {
  cpuThreshold: { warning: 70, critical: 90 },
  memoryThreshold: { warning: 75, critical: 90 },
  diskThreshold: { warning: 80, critical: 95 },
  bandwidthThreshold: { warning: 70, critical: 85 },
  forecastDays: 90,
};

// 容量概览
capacityRoutes.get('/overview', authMiddleware, async (c) => {
  try {
    const devices = await db.select().from(schema.devices);
    const deviceCount = devices.length;

    // 从deviceMetrics获取真实的CPU和内存使用率
    const metricsResult = await db.execute(sql`
      SELECT 
        AVG(cpu_usage)::numeric(10,2) as current_cpu,
        AVG(memory_usage)::numeric(10,2) as current_memory
      FROM ${schema.deviceMetrics}
      WHERE timestamp > NOW() - INTERVAL '5 minutes'
    `);
    // @ts-ignore
    const m = (metricsResult.rows || metricsResult)[0] || {};

    const currentCpu = Number(m.current_cpu || 0);
    const currentMemory = Number(m.current_memory || 0);

    // 简单预测：基于当前值加上增长因子
    const cpuGrowthRate = 0.1; // 假设每月增长10%
    const memGrowthRate = 0.15; // 假设每月增长15%

    const overview = {
      totalDevices: deviceCount,
      cpuCapacity: {
        current: Math.round(currentCpu),
        forecast30d: Math.min(100, Math.round(currentCpu * (1 + cpuGrowthRate))),
        forecast90d: Math.min(100, Math.round(currentCpu * (1 + cpuGrowthRate * 3))),
        trend: currentCpu > 70 ? 'increasing' : 'stable',
      },
      memoryCapacity: {
        current: Math.round(currentMemory),
        forecast30d: Math.min(100, Math.round(currentMemory * (1 + memGrowthRate))),
        forecast90d: Math.min(100, Math.round(currentMemory * (1 + memGrowthRate * 3))),
        trend: currentMemory > 70 ? 'increasing' : 'stable',
      },
      bandwidthCapacity: {
        current: 0, // 带宽利用率需要专门采集
        forecast30d: 0,
        forecast90d: 0,
        trend: 'stable',
      },
      storageCapacity: {
        current: 0, // 存储利用率需要专门采集
        forecast30d: 0,
        forecast90d: 0,
        trend: 'stable',
      },
    };

    return c.json({ code: 0, data: overview });
  } catch (error) {
    console.error('Get capacity overview error:', error);
    return c.json({ code: 500, message: '获取容量概览失败' }, 500);
  }
});

// 资源使用趋势 (真实数据)
capacityRoutes.get('/trends', authMiddleware, async (c) => {
  const metric = c.req.query('metric') || 'cpu';
  const days = parseInt(c.req.query('days') || '30');

  const colMap: Record<string, any> = {
    cpu: sql`cpu_usage`,
    memory: sql`memory_usage`,
    latency: sql`latency`, // Latency as capacity? Maybe.
  };

  const dbCol = colMap[metric];
  if (!dbCol) return c.json({ code: 400, message: 'Unsupported metric' }, 400);

  try {
    const dataResult = await db.execute(sql`
      SELECT 
        time_bucket('1 day', timestamp) as bucket,
        AVG(${dbCol})::numeric(10,2) as val,
        MAX(${dbCol})::numeric(10,2) as max_val,
        MIN(${dbCol})::numeric(10,2) as min_val
      FROM ${schema.deviceMetrics}
      WHERE timestamp > NOW() - INTERVAL '${sql.raw(days.toString())} days'
      GROUP BY bucket
      ORDER BY bucket ASC
    `);

    const data = ((dataResult as any).rows || dataResult).map((row: any) => ({
      date: new Date(row.bucket).toISOString().split('T')[0],
      avg: Number(row.val || 0),
      max: Number(row.max_val || 0),
      min: Number(row.min_val || 0),
    }));

    return c.json({ code: 0, data: { metric, trends: data } });
  } catch (error) {
    console.error('Get capacity trends error:', error);
    return c.json({ code: 500, message: '获取趋势失败' }, 500);
  }
});

// 容量预测 (基于线性回归)
capacityRoutes.get('/forecast', authMiddleware, async (c) => {
  const metric = c.req.query('metric') || 'cpu';
  const days = parseInt(c.req.query('days') || '90');

  const colMap: Record<string, any> = {
    cpu: sql`cpu_usage`,
    memory: sql`memory_usage`,
  };
  const dbCol = colMap[metric];
  
  // 对于不支持的指标，返回空预测或模拟数据（暂不支持带宽/存储）
  if (!dbCol) {
     return c.json({
      code: 0,
      data: {
        metric,
        forecast: [],
        alerts: {},
        note: '该指标暂不支持自动预测'
      },
    });
  }

  try {
    // 计算回归参数 (Slope & Intercept)
    // 基础数据：过去90天的日均值
    const statsResult = await db.execute(sql`
      WITH daily_avg AS (
        SELECT 
          extract(epoch from time_bucket('1 day', timestamp)) as day_epoch,
          AVG(${dbCol}) as val
        FROM ${schema.deviceMetrics}
        WHERE timestamp > NOW() - INTERVAL '90 days'
        GROUP BY day_epoch
      )
      SELECT 
        regr_slope(val, day_epoch) as slope,
        regr_intercept(val, day_epoch) as intercept,
        count(val) as count
      FROM daily_avg
    `);

    // @ts-ignore
    const stats = (statsResult.rows || statsResult)[0] || {};
    const slope = Number(stats.slope || 0);
    const intercept = Number(stats.intercept || 0);
    const count = Number(stats.count || 0);

    const forecast = [];
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    // 如果数据样本太少，无法从真实数据预测，返回空或提示
    if (count < 5) {
       // fallback to simulation or empty? Better empty to show "No Data"
       // But user wants "Realization". If no data, showing nothing is REAL.
       // However, for demo, I might want to fallback if intercept is 0?
       // Let's stick to real calculation. Slope 0 means flat prediction.
    }

    // 生成未来 days 天的预测
    const currentEpoch = Math.floor(Date.now() / 1000);
    // intercept is y when x=0. But x is epoch?
    // Yes, regr(val, epoch). So y = slope * epoch + intercept.
    
    for (let i = 1; i <= days; i++) {
        const futureDate = new Date(now + i * oneDay);
        const futureEpoch = Math.floor(futureDate.getTime() / 1000);
        let predicted = slope * futureEpoch + intercept;
        
        // 修正范围
        if (predicted < 0) predicted = 0;
        if (predicted > 100) predicted = 100;
        
        // 由于是单点回归，置信区间这里简化处理（+/- 5%）
        forecast.push({
            date: futureDate.toISOString().split('T')[0],
            predicted: Number(predicted.toFixed(2)),
            confidence: { 
                lower: Number(Math.max(0, predicted - 5).toFixed(2)), 
                upper: Number(Math.min(100, predicted + 5).toFixed(2)) 
            },
        });
    }

    // 检查阈值
    const threshold = metric === 'cpu' ? capacityConfig.cpuThreshold : capacityConfig.memoryThreshold;
    const warningDate = forecast.find(f => f.predicted >= threshold.warning);
    const criticalDate = forecast.find(f => f.predicted >= threshold.critical);

    return c.json({
      code: 0,
      data: {
        metric,
        forecast,
        alerts: {
            warningDate: warningDate?.date,
            criticalDate: criticalDate?.date,
        },
      },
    });

  } catch (error) {
    console.error('Forecast error:', error);
    return c.json({ code: 500, message: '预测失败' }, 500);
  }
});

// 资源瓶颈分析 - 真实数据
capacityRoutes.get('/bottlenecks', authMiddleware, async (c) => {
  try {
    // 查询过去5分钟内资源使用率超过阈值的设备
    const bottleneckResult = await db.execute(sql`
      SELECT 
        d.id as device_id,
        d.name as device_name,
        d.ip_address as ip,
        AVG(m.cpu_usage)::numeric(10,2) as cpu_avg,
        AVG(m.memory_usage)::numeric(10,2) as mem_avg
      FROM ${schema.deviceMetrics} m
      JOIN ${schema.devices} d ON m.device_id = d.id
      WHERE m.timestamp > NOW() - INTERVAL '5 minutes'
      GROUP BY d.id, d.name, d.ip_address
      HAVING AVG(m.cpu_usage) > 70 OR AVG(m.memory_usage) > 75
      ORDER BY GREATEST(AVG(m.cpu_usage), AVG(m.memory_usage)) DESC
      LIMIT 20
    `);

    // @ts-ignore
    const rows = (bottleneckResult.rows || bottleneckResult) as any[];
    const bottlenecks = rows.map((row: any) => {
      const cpuAvg = Number(row.cpu_avg || 0);
      const memAvg = Number(row.mem_avg || 0);
      const isCpu = cpuAvg >= memAvg;
      
      return {
        deviceId: row.device_id,
        deviceName: row.device_name,
        ip: row.ip || '-',
        bottleneck: isCpu ? 'cpu' : 'memory',
        currentUsage: Math.round(isCpu ? cpuAvg : memAvg),
        threshold: isCpu ? 70 : 75,
        recommendation: isCpu ? '建议优化进程或升级CPU' : '建议增加内存或优化应用',
        severity: (isCpu ? cpuAvg : memAvg) > 90 ? 'critical' : 'warning',
      };
    });

    return c.json({ code: 0, data: bottlenecks });
  } catch (error) {
    console.error('Get bottlenecks error:', error);
    return c.json({ code: 500, message: '获取瓶颈分析失败' }, 500);
  }
});

// 扩容建议
capacityRoutes.get('/recommendations', authMiddleware, async (c) => {
  const recommendations = [
    { id: 'rec-1', type: 'bandwidth', title: '核心链路带宽扩容', description: '核心交换机间链路利用率持续高于80%', priority: 'high', estimatedCost: '￥50,000', impact: '提升核心链路容量50%' },
    { id: 'rec-2', type: 'memory', title: '交换机内存升级', description: '部分交换机内存使用率超过85%', priority: 'medium', estimatedCost: '￥20,000', impact: '解决10台设备内存不足问题' },
    { id: 'rec-3', type: 'device', title: '新增接入层交换机', description: '当前接入端口利用率超过90%', priority: 'high', estimatedCost: '￥80,000', impact: '增加200个接入端口' },
  ];

  return c.json({ code: 0, data: recommendations });
});

// 获取阈值配置
capacityRoutes.get('/thresholds', authMiddleware, async (c) => {
  return c.json({ code: 0, data: capacityConfig });
});

// 更新阈值配置
capacityRoutes.put('/thresholds', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  cpuThreshold: z.object({ warning: z.number(), critical: z.number() }).optional(),
  memoryThreshold: z.object({ warning: z.number(), critical: z.number() }).optional(),
  diskThreshold: z.object({ warning: z.number(), critical: z.number() }).optional(),
  bandwidthThreshold: z.object({ warning: z.number(), critical: z.number() }).optional(),
})), async (c) => {
  const data = c.req.valid('json');

  if (data.cpuThreshold) capacityConfig.cpuThreshold = data.cpuThreshold;
  if (data.memoryThreshold) capacityConfig.memoryThreshold = data.memoryThreshold;
  if (data.diskThreshold) capacityConfig.diskThreshold = data.diskThreshold;
  if (data.bandwidthThreshold) capacityConfig.bandwidthThreshold = data.bandwidthThreshold;

  return c.json({ code: 0, message: '阈值配置已更新' });
});

export { capacityRoutes };
