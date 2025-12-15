import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const networkQualityRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 生成模拟数据
const generateLatencyData = (points: number) => {
  const data = [];
  const now = Date.now();
  for (let i = points - 1; i >= 0; i--) {
    data.push({
      timestamp: new Date(now - i * 60000),
      latency: Math.floor(Math.random() * 30 + 10),
      jitter: Math.floor(Math.random() * 5 + 1),
      packetLoss: Math.random() * 0.5,
    });
  }
  return data;
};

// 网络质量概览
networkQualityRoutes.get('/overview', authMiddleware, async (c) => {
  const overview = {
    avgLatency: Math.floor(Math.random() * 20 + 15),
    avgJitter: Math.floor(Math.random() * 3 + 2),
    packetLoss: (Math.random() * 0.3).toFixed(2),
    availability: (99 + Math.random() * 0.9).toFixed(2),
    throughput: Math.floor(Math.random() * 500 + 800),
    activeProbes: 12,
    healthyLinks: 145,
    degradedLinks: 3,
    downLinks: 2,
  };

  return c.json({ code: 0, data: overview });
});

// 链路健康列表
networkQualityRoutes.get('/links', authMiddleware, async (c) => {
  const devices = await db.select().from(schema.devices).limit(10);

  const links = devices.map((d, i) => ({
    id: `link-${i}`,
    sourceDevice: d.name,
    sourceIp: d.ipAddress,
    targetDevice: `Core-Switch-${i + 1}`,
    targetIp: `10.0.0.${i + 1}`,
    latency: Math.floor(Math.random() * 30 + 5),
    jitter: Math.floor(Math.random() * 5 + 1),
    packetLoss: (Math.random() * 0.5).toFixed(2),
    bandwidth: Math.floor(Math.random() * 1000 + 100),
    status: Math.random() > 0.1 ? 'healthy' : 'degraded',
  }));

  return c.json({ code: 0, data: links });
});

// 单链路详情
networkQualityRoutes.get('/links/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');

  const linkDetail = {
    id,
    sourceDevice: 'Router-01',
    sourceIp: '192.168.1.1',
    targetDevice: 'Core-Switch-01',
    targetIp: '10.0.0.1',
    currentLatency: Math.floor(Math.random() * 30 + 10),
    avgLatency24h: Math.floor(Math.random() * 25 + 12),
    maxLatency24h: Math.floor(Math.random() * 50 + 30),
    jitter: Math.floor(Math.random() * 5 + 2),
    packetLoss: (Math.random() * 0.3).toFixed(2),
    availability24h: (99 + Math.random() * 0.9).toFixed(2),
    bandwidth: 1000,
    utilization: Math.floor(Math.random() * 60 + 20),
    trend: generateLatencyData(60),
  };

  return c.json({ code: 0, data: linkDetail });
});

// Ping测试
networkQualityRoutes.post('/ping', authMiddleware, zValidator('json', z.object({
  target: z.string(),
  count: z.number().optional().default(4),
})), async (c) => {
  const { target, count } = c.req.valid('json');

  // 模拟ping结果
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push({
      seq: i + 1,
      ttl: 64,
      time: Math.floor(Math.random() * 20 + 5),
    });
  }

  const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;

  return c.json({
    code: 0,
    data: {
      target,
      count,
      results,
      stats: {
        transmitted: count,
        received: count,
        loss: 0,
        min: Math.min(...results.map(r => r.time)),
        max: Math.max(...results.map(r => r.time)),
        avg: avgTime.toFixed(1),
      },
    },
  });
});

// Traceroute测试
networkQualityRoutes.post('/traceroute', authMiddleware, zValidator('json', z.object({
  target: z.string(),
})), async (c) => {
  const { target } = c.req.valid('json');

  // 模拟traceroute结果
  const hops = [
    { hop: 1, ip: '192.168.1.1', hostname: 'gateway.local', time: [2, 3, 2] },
    { hop: 2, ip: '10.0.0.1', hostname: 'core-switch.local', time: [5, 4, 5] },
    { hop: 3, ip: '172.16.0.1', hostname: 'border-router.local', time: [8, 7, 9] },
    { hop: 4, ip: target, hostname: target, time: [12, 11, 13] },
  ];

  return c.json({ code: 0, data: { target, hops } });
});

// 带宽测试
networkQualityRoutes.post('/bandwidth-test', authMiddleware, zValidator('json', z.object({
  target: z.string(),
  duration: z.number().optional().default(10),
})), async (c) => {
  const { target, duration } = c.req.valid('json');

  // 模拟带宽测试结果
  return c.json({
    code: 0,
    data: {
      target,
      duration,
      download: {
        speed: Math.floor(Math.random() * 500 + 500),
        unit: 'Mbps',
      },
      upload: {
        speed: Math.floor(Math.random() * 200 + 300),
        unit: 'Mbps',
      },
      latency: Math.floor(Math.random() * 10 + 5),
      jitter: Math.floor(Math.random() * 3 + 1),
    },
  });
});

// 获取告警阈值配置
networkQualityRoutes.get('/thresholds', authMiddleware, async (c) => {
  const thresholds = {
    latency: { warning: 50, critical: 100 },
    jitter: { warning: 10, critical: 30 },
    packetLoss: { warning: 1, critical: 5 },
    availability: { warning: 99, critical: 95 },
  };

  return c.json({ code: 0, data: thresholds });
});

// 获取网络质量历史趋势
networkQualityRoutes.get('/trends', authMiddleware, async (c) => {
  const range = c.req.query('range') || '24h';
  const points = range === '1h' ? 60 : range === '6h' ? 360 : 1440;

  return c.json({
    code: 0,
    data: {
      latency: generateLatencyData(Math.min(points, 100)),
      availability: Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        value: 99 + Math.random() * 0.9,
      })),
    },
  });
});

export { networkQualityRoutes };
