import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const performanceRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 生成模拟时序数据
const generateTimeSeriesData = (points: number, baseValue: number, variance: number) => {
  const data = [];
  const now = Date.now();
  for (let i = points - 1; i >= 0; i--) {
    const timestamp = new Date(now - i * 60000); // 每分钟一个点
    const value = baseValue + (Math.random() - 0.5) * variance;
    data.push({ timestamp, value: Math.max(0, Math.min(100, value)) });
  }
  return data;
};

// 系统性能概览
performanceRoutes.get('/overview', authMiddleware, async (c) => {
  const overview = {
    cpu: {
      current: Math.floor(Math.random() * 30 + 20),
      avg24h: 35,
      peak24h: 78,
      trend: generateTimeSeriesData(60, 30, 20),
    },
    memory: {
      current: Math.floor(Math.random() * 20 + 50),
      total: 32768, // MB
      used: 22938,
      avg24h: 68,
      trend: generateTimeSeriesData(60, 65, 10),
    },
    disk: {
      current: 45,
      total: 500, // GB
      used: 225,
      readRate: Math.floor(Math.random() * 100 + 50),
      writeRate: Math.floor(Math.random() * 80 + 30),
    },
    network: {
      inbound: Math.floor(Math.random() * 500 + 200), // Mbps
      outbound: Math.floor(Math.random() * 300 + 100),
      packetsIn: Math.floor(Math.random() * 100000 + 50000),
      packetsOut: Math.floor(Math.random() * 80000 + 40000),
      trend: generateTimeSeriesData(60, 300, 150),
    },
    database: {
      connections: Math.floor(Math.random() * 20 + 10),
      maxConnections: 100,
      queryTime: Math.floor(Math.random() * 50 + 10), // ms
      activeQueries: Math.floor(Math.random() * 5 + 1),
    },
  };

  return c.json({ code: 0, data: overview });
});

// 获取设备性能排行
performanceRoutes.get('/top-devices', authMiddleware, async (c) => {
  const metric = c.req.query('metric') || 'cpu';
  const limit = parseInt(c.req.query('limit') || '10');

  try {
    const devices = await db.select().from(schema.devices).limit(limit);

    const topDevices = devices.map((d, i) => ({
      id: d.id,
      name: d.name,
      ip: d.ipAddress,
      value: Math.floor(Math.random() * 60 + 20),
      status: d.status,
      rank: i + 1,
    })).sort((a, b) => b.value - a.value);

    return c.json({ code: 0, data: topDevices });
  } catch (error) {
    return c.json({ code: 500, message: '查询失败' }, 500);
  }
});

// 获取指定设备的性能详情
performanceRoutes.get('/device/:id', authMiddleware, async (c) => {
  const deviceId = c.req.param('id');
  const timeRange = c.req.query('range') || '1h'; // 1h, 6h, 24h, 7d

  const points = timeRange === '1h' ? 60 : timeRange === '6h' ? 360 : timeRange === '24h' ? 1440 : 10080;

  const metrics = {
    cpu: generateTimeSeriesData(Math.min(points, 100), 35, 25),
    memory: generateTimeSeriesData(Math.min(points, 100), 60, 15),
    traffic: {
      in: generateTimeSeriesData(Math.min(points, 100), 200, 100),
      out: generateTimeSeriesData(Math.min(points, 100), 150, 80),
    },
    latency: generateTimeSeriesData(Math.min(points, 100), 20, 10),
    packetLoss: generateTimeSeriesData(Math.min(points, 100), 0.5, 1),
  };

  return c.json({ code: 0, data: { deviceId, timeRange, metrics } });
});

// 获取服务健康状态
performanceRoutes.get('/services', authMiddleware, async (c) => {
  const services = [
    { name: 'API Server', status: 'healthy', uptime: '15d 8h 32m', responseTime: 45, cpu: 12, memory: 256 },
    { name: 'Database', status: 'healthy', uptime: '30d 2h 15m', responseTime: 8, connections: 35, slowQueries: 2 },
    { name: 'Redis Cache', status: 'healthy', uptime: '30d 2h 15m', hitRate: 98.5, usedMemory: 128, maxMemory: 512 },
    { name: 'Collector', status: 'healthy', uptime: '7d 12h 45m', devicesCovered: 150, pollRate: 10 },
    { name: 'Alert Engine', status: 'healthy', uptime: '7d 12h 45m', rulesActive: 25, eventsProcessed: 15000 },
    { name: 'Nginx', status: 'healthy', uptime: '30d 2h 15m', requestsPerSec: 125, activeConnections: 45 },
  ];

  return c.json({ code: 0, data: services });
});

// 获取告警趋势
performanceRoutes.get('/alert-trends', authMiddleware, async (c) => {
  const days = parseInt(c.req.query('days') || '7');
  const trends = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    trends.push({
      date: date.toISOString().split('T')[0],
      critical: Math.floor(Math.random() * 5),
      warning: Math.floor(Math.random() * 15 + 5),
      info: Math.floor(Math.random() * 30 + 10),
    });
  }

  return c.json({ code: 0, data: trends });
});

// 获取慢查询日志
performanceRoutes.get('/slow-queries', authMiddleware, async (c) => {
  const slowQueries = [
    { id: 1, query: 'SELECT * FROM devices WHERE status = ?', duration: 1250, timestamp: new Date(Date.now() - 3600000) },
    { id: 2, query: 'SELECT * FROM metrics WHERE device_id = ?', duration: 890, timestamp: new Date(Date.now() - 7200000) },
    { id: 3, query: 'UPDATE alerts SET acknowledged_at = ?', duration: 650, timestamp: new Date(Date.now() - 10800000) },
  ];

  return c.json({ code: 0, data: slowQueries });
});

export { performanceRoutes };
