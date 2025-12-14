import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc, count } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const bigscreenRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 大屏配置存储
const bigscreenConfigs = new Map<string, {
  id: string;
  name: string;
  layout: string;
  widgets: Array<{
    id: string;
    type: string;
    title: string;
    position: { x: number; y: number; w: number; h: number };
    config: Record<string, any>;
  }>;
  refreshInterval: number;
  createdBy: string;
  createdAt: Date;
}>();

// 预置大屏配置
const defaultConfig = {
  id: 'default',
  name: '默认监控大屏',
  layout: 'grid',
  widgets: [
    { id: 'w1', type: 'device-status', title: '设备状态概览', position: { x: 0, y: 0, w: 6, h: 2 }, config: {} },
    { id: 'w2', type: 'alert-summary', title: '告警统计', position: { x: 6, y: 0, w: 3, h: 2 }, config: {} },
    { id: 'w3', type: 'topology-mini', title: '网络拓扑', position: { x: 9, y: 0, w: 3, h: 2 }, config: {} },
    { id: 'w4', type: 'traffic-chart', title: '流量趋势', position: { x: 0, y: 2, w: 6, h: 2 }, config: {} },
    { id: 'w5', type: 'top-devices', title: 'TOP设备', position: { x: 6, y: 2, w: 3, h: 2 }, config: {} },
    { id: 'w6', type: 'recent-alerts', title: '最新告警', position: { x: 9, y: 2, w: 3, h: 2 }, config: {} },
  ],
  refreshInterval: 30,
  createdBy: 'system',
  createdAt: new Date(),
};
bigscreenConfigs.set('default', defaultConfig);

// 获取大屏实时数据
bigscreenRoutes.get('/data', authMiddleware, async (c) => {
  try {
    const devices = await db.select().from(schema.devices);
    const alerts = await db.select().from(schema.alerts).limit(10).orderBy(desc(schema.alerts.createdAt));

    // 设备状态统计
    const deviceStats = {
      total: devices.length,
      online: devices.filter(d => d.status === 'online').length,
      offline: devices.filter(d => d.status === 'offline').length,
      warning: devices.filter(d => d.status === 'warning').length,
    };

    // 告警统计
    const alertStats = {
      total: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      warning: alerts.filter(a => a.severity === 'warning').length,
      info: alerts.filter(a => a.severity === 'info').length,
    };

    // 模拟流量数据
    const trafficData = [];
    for (let i = 23; i >= 0; i--) {
      trafficData.push({
        time: `${String(23 - i).padStart(2, '0')}:00`,
        inbound: Math.floor(Math.random() * 1000) + 500,
        outbound: Math.floor(Math.random() * 800) + 300,
      });
    }

    // TOP设备
    const topDevices = devices.slice(0, 5).map(d => ({
      id: d.id,
      name: d.name,
      cpu: Math.floor(Math.random() * 40) + 30,
      memory: Math.floor(Math.random() * 30) + 40,
    }));

    return c.json({
      code: 0,
      data: {
        timestamp: new Date(),
        deviceStats,
        alertStats,
        trafficData,
        topDevices,
        recentAlerts: alerts.slice(0, 5),
      },
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取数据失败' }, 500);
  }
});

// 获取大屏配置列表
bigscreenRoutes.get('/configs', authMiddleware, async (c) => {
  const configs = Array.from(bigscreenConfigs.values());
  return c.json({ code: 0, data: configs });
});

// 获取单个大屏配置
bigscreenRoutes.get('/configs/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const config = bigscreenConfigs.get(id);

  if (!config) {
    return c.json({ code: 404, message: '配置不存在' }, 404);
  }

  return c.json({ code: 0, data: config });
});

// 创建大屏配置
bigscreenRoutes.post('/configs', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  name: z.string().min(1),
  layout: z.string().default('grid'),
  widgets: z.array(z.any()).optional(),
  refreshInterval: z.number().default(30),
})), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const id = crypto.randomUUID();
    bigscreenConfigs.set(id, {
      id,
      name: data.name,
      layout: data.layout,
      widgets: data.widgets || [],
      refreshInterval: data.refreshInterval,
      createdBy: currentUser.userId,
      createdAt: new Date(),
    });

    return c.json({ code: 0, message: '配置创建成功', data: { id } });
  } catch (error) {
    return c.json({ code: 500, message: '创建失败' }, 500);
  }
});

// 更新大屏配置
bigscreenRoutes.put('/configs/:id', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  name: z.string().optional(),
  layout: z.string().optional(),
  widgets: z.array(z.any()).optional(),
  refreshInterval: z.number().optional(),
})), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  try {
    const config = bigscreenConfigs.get(id);
    if (!config) {
      return c.json({ code: 404, message: '配置不存在' }, 404);
    }

    if (data.name) config.name = data.name;
    if (data.layout) config.layout = data.layout;
    if (data.widgets) config.widgets = data.widgets;
    if (data.refreshInterval) config.refreshInterval = data.refreshInterval;

    return c.json({ code: 0, message: '配置更新成功' });
  } catch (error) {
    return c.json({ code: 500, message: '更新失败' }, 500);
  }
});

// 可用组件列表
bigscreenRoutes.get('/widgets', authMiddleware, async (c) => {
  const widgets = [
    { type: 'device-status', name: '设备状态概览', icon: 'desktop', size: { w: 6, h: 2 } },
    { type: 'alert-summary', name: '告警统计', icon: 'warning', size: { w: 3, h: 2 } },
    { type: 'topology-mini', name: '网络拓扑', icon: 'apartment', size: { w: 3, h: 2 } },
    { type: 'traffic-chart', name: '流量趋势', icon: 'line-chart', size: { w: 6, h: 2 } },
    { type: 'top-devices', name: 'TOP设备', icon: 'bar-chart', size: { w: 3, h: 2 } },
    { type: 'recent-alerts', name: '最新告警', icon: 'bell', size: { w: 3, h: 2 } },
    { type: 'cpu-gauge', name: 'CPU仪表盘', icon: 'dashboard', size: { w: 2, h: 2 } },
    { type: 'memory-gauge', name: '内存仪表盘', icon: 'dashboard', size: { w: 2, h: 2 } },
    { type: 'world-map', name: '地理分布', icon: 'global', size: { w: 6, h: 3 } },
    { type: 'clock', name: '时钟', icon: 'clock-circle', size: { w: 2, h: 1 } },
  ];

  return c.json({ code: 0, data: widgets });
});

export { bigscreenRoutes };
