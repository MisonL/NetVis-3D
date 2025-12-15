import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const dashboardRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 用户仪表盘配置存储
const userDashboards = new Map<string, {
  userId: string;
  layout: {
    id: string;
    type: string;
    x: number;
    y: number;
    w: number;
    h: number;
    config: Record<string, unknown>;
  }[];
  theme: string;
  refreshInterval: number;
  updatedAt: Date;
}>();

// 可用的组件列表
const availableWidgets = [
  { id: 'device-stats', name: '设备统计', type: 'stat', defaultW: 6, defaultH: 4, icon: 'DesktopOutlined' },
  { id: 'alert-stats', name: '告警统计', type: 'stat', defaultW: 6, defaultH: 4, icon: 'AlertOutlined' },
  { id: 'online-rate', name: '在线率', type: 'progress', defaultW: 6, defaultH: 4, icon: 'CheckCircleOutlined' },
  { id: 'traffic-trend', name: '流量趋势', type: 'chart', defaultW: 12, defaultH: 8, icon: 'LineChartOutlined' },
  { id: 'top-devices', name: 'TOP设备', type: 'list', defaultW: 6, defaultH: 8, icon: 'OrderedListOutlined' },
  { id: 'recent-alerts', name: '最近告警', type: 'list', defaultW: 6, defaultH: 8, icon: 'BellOutlined' },
  { id: 'device-type-pie', name: '设备类型', type: 'chart', defaultW: 6, defaultH: 6, icon: 'PieChartOutlined' },
  { id: 'system-health', name: '系统健康', type: 'gauge', defaultW: 6, defaultH: 6, icon: 'DashboardOutlined' },
  { id: 'quick-actions', name: '快捷操作', type: 'actions', defaultW: 6, defaultH: 4, icon: 'ThunderboltOutlined' },
  { id: 'oncall-info', name: '值班信息', type: 'info', defaultW: 6, defaultH: 4, icon: 'TeamOutlined' },
];

// 默认布局
const defaultLayout = [
  { id: 'device-stats', type: 'stat', x: 0, y: 0, w: 6, h: 4, config: {} },
  { id: 'alert-stats', type: 'stat', x: 6, y: 0, w: 6, h: 4, config: {} },
  { id: 'online-rate', type: 'progress', x: 12, y: 0, w: 6, h: 4, config: {} },
  { id: 'system-health', type: 'gauge', x: 18, y: 0, w: 6, h: 4, config: {} },
  { id: 'traffic-trend', type: 'chart', x: 0, y: 4, w: 12, h: 8, config: {} },
  { id: 'top-devices', type: 'list', x: 12, y: 4, w: 6, h: 8, config: {} },
  { id: 'recent-alerts', type: 'list', x: 18, y: 4, w: 6, h: 8, config: {} },
];

// 获取用户仪表盘配置
dashboardRoutes.get('/config', authMiddleware, async (c) => {
  const currentUser = c.get('user');
  const userId = currentUser.userId;

  let config = userDashboards.get(userId);
  if (!config) {
    config = {
      userId,
      layout: defaultLayout,
      theme: 'default',
      refreshInterval: 30,
      updatedAt: new Date(),
    };
    userDashboards.set(userId, config);
  }

  return c.json({ code: 0, data: config });
});

// 保存用户仪表盘配置
dashboardRoutes.put('/config', authMiddleware, zValidator('json', z.object({
  layout: z.array(z.object({
    id: z.string(),
    type: z.string(),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    config: z.record(z.unknown()).optional(),
  })),
  theme: z.string().optional(),
  refreshInterval: z.number().optional(),
})), async (c) => {
  const currentUser = c.get('user');
  const userId = currentUser.userId;
  const data = c.req.valid('json');

  try {
    userDashboards.set(userId, {
      userId,
      layout: data.layout,
      theme: data.theme || 'default',
      refreshInterval: data.refreshInterval || 30,
      updatedAt: new Date(),
    });

    return c.json({ code: 0, message: '仪表盘配置已保存' });
  } catch (error) {
    return c.json({ code: 500, message: '保存失败' }, 500);
  }
});

// 重置为默认配置
dashboardRoutes.post('/config/reset', authMiddleware, async (c) => {
  const currentUser = c.get('user');
  const userId = currentUser.userId;

  try {
    userDashboards.set(userId, {
      userId,
      layout: defaultLayout,
      theme: 'default',
      refreshInterval: 30,
      updatedAt: new Date(),
    });

    return c.json({ code: 0, message: '已重置为默认配置' });
  } catch (error) {
    return c.json({ code: 500, message: '重置失败' }, 500);
  }
});

// 获取可用组件列表
dashboardRoutes.get('/widgets', authMiddleware, async (c) => {
  return c.json({ code: 0, data: availableWidgets });
});

// 获取组件数据（统一入口）
dashboardRoutes.get('/widget/:id/data', authMiddleware, async (c) => {
  const widgetId = c.req.param('id');

  try {
    let data;
    switch (widgetId) {
      case 'device-stats':
        const devices = await db.select().from(schema.devices);
        data = {
          total: devices.length,
          online: devices.filter(d => d.status === 'online').length,
          offline: devices.filter(d => d.status === 'offline').length,
        };
        break;
      case 'alert-stats':
        const alerts = await db.select().from(schema.alerts);
        data = {
          total: alerts.length,
          unacked: alerts.filter(a => !a.acknowledgedAt).length,
          critical: alerts.filter(a => a.severity === 'critical').length,
        };
        break;
      case 'online-rate':
        const allDevices = await db.select().from(schema.devices);
        const onlineCount = allDevices.filter(d => d.status === 'online').length;
        data = {
          rate: allDevices.length > 0 ? Math.round((onlineCount / allDevices.length) * 100) : 0,
          online: onlineCount,
          total: allDevices.length,
        };
        break;
      case 'top-devices':
        data = (await db.select().from(schema.devices).limit(5)).map(d => ({
          id: d.id,
          name: d.name,
          ip: d.ip,
          status: d.status,
        }));
        break;
      case 'recent-alerts':
        data = (await db.select().from(schema.alerts).limit(5)).map(a => ({
          id: a.id,
          message: a.message,
          severity: a.severity,
          createdAt: a.createdAt,
        }));
        break;
      default:
        data = { message: '组件数据待实现' };
    }

    return c.json({ code: 0, data });
  } catch (error) {
    return c.json({ code: 500, message: '获取数据失败' }, 500);
  }
});

export { dashboardRoutes };
