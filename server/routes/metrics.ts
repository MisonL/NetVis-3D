import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const metricsRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 查询参数
const querySchema = z.object({
  deviceId: z.string().uuid().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  interval: z.enum(['1m', '5m', '15m', '1h', '6h', '1d']).optional(),
  limit: z.string().optional().transform(v => parseInt(v || '100')),
});

// 获取设备指标
metricsRoutes.get('/device/:id', authMiddleware, async (c) => {
  const deviceId = c.req.param('id');
  const limit = parseInt(c.req.query('limit') || '100');
  const startTime = c.req.query('startTime');
  const endTime = c.req.query('endTime');

  try {
    let query = db
      .select()
      .from(schema.deviceMetrics)
      .where(eq(schema.deviceMetrics.deviceId, deviceId))
      .orderBy(desc(schema.deviceMetrics.timestamp))
      .limit(limit);

    const metrics = await query;

    return c.json({
      code: 0,
      data: metrics,
    });
  } catch (error) {
    console.error('Get device metrics error:', error);
    return c.json({ code: 500, message: '获取设备指标失败' }, 500);
  }
});

// 获取接口流量指标
metricsRoutes.get('/interface/:deviceId', authMiddleware, async (c) => {
  const deviceId = c.req.param('deviceId');
  const interfaceName = c.req.query('interface');
  const limit = parseInt(c.req.query('limit') || '100');

  try {
    const conditions = [eq(schema.interfaceMetrics.deviceId, deviceId)];
    if (interfaceName) {
      conditions.push(eq(schema.interfaceMetrics.interfaceName, interfaceName));
    }

    const metrics = await db
      .select()
      .from(schema.interfaceMetrics)
      .where(and(...conditions))
      .orderBy(desc(schema.interfaceMetrics.timestamp))
      .limit(limit);

    return c.json({
      code: 0,
      data: metrics,
    });
  } catch (error) {
    console.error('Get interface metrics error:', error);
    return c.json({ code: 500, message: '获取接口指标失败' }, 500);
  }
});

// 获取聚合统计 (模拟TimescaleDB time_bucket)
metricsRoutes.get('/aggregated', authMiddleware, zValidator('query', querySchema), async (c) => {
  const { deviceId, startTime, endTime, interval, limit } = c.req.valid('query');

  try {
    // 简化实现 - 返回模拟聚合数据
    // 实际应使用 TimescaleDB 的 time_bucket 函数
    const now = new Date();
    const data = [];
    
    const intervalMs = {
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '1h': 3600000,
      '6h': 21600000,
      '1d': 86400000,
    }[interval || '1h'];

    for (let i = 0; i < (limit || 24); i++) {
      const time = new Date(now.getTime() - i * intervalMs);
      data.push({
        timestamp: time.toISOString(),
        avgLatency: Math.random() * 50 + 10,
        maxLatency: Math.random() * 100 + 50,
        minLatency: Math.random() * 10 + 1,
        avgCpu: Math.random() * 60 + 20,
        avgMemory: Math.random() * 40 + 40,
        onlineRate: 95 + Math.random() * 5,
      });
    }

    return c.json({
      code: 0,
      data: data.reverse(),
    });
  } catch (error) {
    console.error('Get aggregated metrics error:', error);
    return c.json({ code: 500, message: '获取聚合指标失败' }, 500);
  }
});

// 获取实时仪表盘数据
metricsRoutes.get('/dashboard', authMiddleware, async (c) => {
  try {
    const devices = await db.select().from(schema.devices);
    
    const stats = {
      totalDevices: devices.length,
      onlineDevices: devices.filter(d => d.status === 'online').length,
      offlineDevices: devices.filter(d => d.status === 'offline').length,
      warningDevices: devices.filter(d => d.status === 'warning').length,
      avgLatency: 25.5,
      avgCpu: 45.2,
      avgMemory: 62.8,
      totalTrafficIn: 1024 * 1024 * 500, // 500MB
      totalTrafficOut: 1024 * 1024 * 300, // 300MB
    };

    // 最近趋势 (模拟)
    const trend = [];
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 3600000);
      trend.push({
        hour: time.getHours(),
        online: Math.floor(stats.totalDevices * (0.9 + Math.random() * 0.1)),
        latency: 20 + Math.random() * 30,
      });
    }

    return c.json({
      code: 0,
      data: {
        stats,
        trend,
      },
    });
  } catch (error) {
    console.error('Get dashboard metrics error:', error);
    return c.json({ code: 500, message: '获取仪表盘数据失败' }, 500);
  }
});

// 获取Top N设备
metricsRoutes.get('/top', authMiddleware, async (c) => {
  const metric = c.req.query('metric') || 'latency'; // latency, cpu, memory, traffic
  const limit = parseInt(c.req.query('limit') || '10');

  try {
    const devices = await db.select().from(schema.devices).limit(limit);

    // 模拟指标数据
    const topDevices = devices.map(d => ({
      deviceId: d.id,
      deviceName: d.name,
      ip: d.ipAddress,
      value: metric === 'latency' ? Math.random() * 100 :
             metric === 'cpu' ? Math.random() * 100 :
             metric === 'memory' ? Math.random() * 100 :
             Math.random() * 1000000,
    })).sort((a, b) => b.value - a.value);

    return c.json({
      code: 0,
      data: topDevices,
    });
  } catch (error) {
    console.error('Get top devices error:', error);
    return c.json({ code: 500, message: '获取Top设备失败' }, 500);
  }
});

// 保存指标数据 (内部接口)
metricsRoutes.post('/store', async (c) => {
  try {
    const { deviceId, collectorId, metrics } = await c.req.json();

    await db.insert(schema.deviceMetrics).values({
      deviceId,
      collectorId,
      status: metrics.status,
      latency: Math.round(metrics.latency),
      packetLoss: Math.round(metrics.packetLoss || 0),
      cpuUsage: Math.round(metrics.cpuUsage || 0),
      memoryUsage: Math.round(metrics.memoryUsage || 0),
      uptime: metrics.uptime,
    });

    return c.json({ code: 0, message: 'OK' });
  } catch (error) {
    console.error('Store metrics error:', error);
    return c.json({ code: 500, message: '存储指标失败' }, 500);
  }
});

export { metricsRoutes };
