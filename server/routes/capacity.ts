import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
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
  const devices = await db.select().from(schema.devices);
  const deviceCount = devices.length;

  const overview = {
    totalDevices: deviceCount,
    cpuCapacity: {
      current: Math.floor(Math.random() * 30 + 35),
      forecast30d: Math.floor(Math.random() * 10 + 40),
      forecast90d: Math.floor(Math.random() * 15 + 45),
      trend: 'stable',
    },
    memoryCapacity: {
      current: Math.floor(Math.random() * 20 + 55),
      forecast30d: Math.floor(Math.random() * 8 + 58),
      forecast90d: Math.floor(Math.random() * 12 + 62),
      trend: 'increasing',
    },
    bandwidthCapacity: {
      current: Math.floor(Math.random() * 25 + 45),
      forecast30d: Math.floor(Math.random() * 10 + 50),
      forecast90d: Math.floor(Math.random() * 15 + 55),
      trend: 'increasing',
    },
    storageCapacity: {
      current: Math.floor(Math.random() * 15 + 40),
      forecast30d: Math.floor(Math.random() * 5 + 42),
      forecast90d: Math.floor(Math.random() * 8 + 45),
      trend: 'stable',
    },
  };

  return c.json({ code: 0, data: overview });
});

// 资源使用趋势
capacityRoutes.get('/trends', authMiddleware, async (c) => {
  const metric = c.req.query('metric') || 'cpu';
  const days = parseInt(c.req.query('days') || '30');

  const data = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now - i * 24 * 60 * 60 * 1000);
    data.push({
      date: date.toISOString().split('T')[0],
      avg: Math.floor(Math.random() * 20 + 40),
      max: Math.floor(Math.random() * 30 + 60),
      min: Math.floor(Math.random() * 15 + 25),
    });
  }

  return c.json({ code: 0, data: { metric, trends: data } });
});

// 容量预测
capacityRoutes.get('/forecast', authMiddleware, async (c) => {
  const metric = c.req.query('metric') || 'cpu';
  const days = parseInt(c.req.query('days') || '90');

  const forecast = [];
  const now = Date.now();
  const baseValue = Math.floor(Math.random() * 20 + 40);
  const growthRate = Math.random() * 0.5 + 0.1; // 每天增长0.1%-0.6%

  for (let i = 0; i < days; i++) {
    const date = new Date(now + i * 24 * 60 * 60 * 1000);
    const value = Math.min(95, baseValue + i * growthRate);
    forecast.push({
      date: date.toISOString().split('T')[0],
      predicted: Math.floor(value),
      confidence: { lower: Math.floor(value - 5), upper: Math.floor(value + 5) },
    });
  }

  // 计算预计达到阈值的日期
  const warningDate = forecast.find(f => f.predicted >= capacityConfig.cpuThreshold.warning);
  const criticalDate = forecast.find(f => f.predicted >= capacityConfig.cpuThreshold.critical);

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
});

// 资源瓶颈分析
capacityRoutes.get('/bottlenecks', authMiddleware, async (c) => {
  const devices = await db.select().from(schema.devices).limit(10);

  const bottlenecks = devices.map(d => ({
    deviceId: d.id,
    deviceName: d.name,
    ip: d.ipAddress,
    bottleneck: ['cpu', 'memory', 'bandwidth', 'disk'][Math.floor(Math.random() * 4)],
    currentUsage: Math.floor(Math.random() * 20 + 75),
    threshold: 80,
    recommendation: '建议升级或分流',
    severity: Math.random() > 0.5 ? 'warning' : 'critical',
  })).filter(() => Math.random() > 0.6); // 随机筛选部分设备

  return c.json({ code: 0, data: bottlenecks });
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
