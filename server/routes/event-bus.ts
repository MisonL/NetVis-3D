import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const eventBusRoutes = new Hono<{ Variables: { user: JwtPayload } }>();

// 事件订阅
const subscriptions = new Map<string, {
  id: string;
  topic: string;
  callback: string;
  filter: Record<string, string>;
  enabled: boolean;
  createdAt: Date;
}>();

// 事件历史
const eventHistory: {
  id: string;
  topic: string;
  payload: Record<string, unknown>;
  timestamp: Date;
}[] = [];

// 事件主题
const topics = [
  { id: 'device.status', name: '设备状态变化', description: '设备上线/下线' },
  { id: 'alert.triggered', name: '告警触发', description: '新告警产生' },
  { id: 'alert.resolved', name: '告警解决', description: '告警已处理' },
  { id: 'config.changed', name: '配置变更', description: '设备配置发生变化' },
  { id: 'user.login', name: '用户登录', description: '用户登录系统' },
  { id: 'backup.completed', name: '备份完成', description: '数据备份完成' },
];

// 获取主题列表
eventBusRoutes.get('/topics', authMiddleware, async (c) => {
  return c.json({ code: 0, data: topics });
});

// 获取订阅列表
eventBusRoutes.get('/subscriptions', authMiddleware, async (c) => {
  return c.json({ code: 0, data: Array.from(subscriptions.values()) });
});

// 创建订阅
eventBusRoutes.post('/subscriptions', authMiddleware, zValidator('json', z.object({
  topic: z.string(),
  callback: z.string(),
  filter: z.record(z.string(), z.string()).optional(),
})), async (c) => {
  const data = c.req.valid('json');
  const id = crypto.randomUUID();
  subscriptions.set(id, { id, ...data, filter: data.filter || {}, enabled: true, createdAt: new Date() });
  return c.json({ code: 0, message: '订阅已创建', data: { id } });
});

// 删除订阅
eventBusRoutes.delete('/subscriptions/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  if (!subscriptions.has(id)) return c.json({ code: 404, message: '订阅不存在' }, 404);
  subscriptions.delete(id);
  return c.json({ code: 0, message: '订阅已删除' });
});

// 启用/禁用订阅
eventBusRoutes.post('/subscriptions/:id/toggle', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const sub = subscriptions.get(id);
  if (!sub) return c.json({ code: 404, message: '订阅不存在' }, 404);
  sub.enabled = !sub.enabled;
  return c.json({ code: 0, message: sub.enabled ? '已启用' : '已禁用' });
});

// 发布事件(内部使用)
eventBusRoutes.post('/publish', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  topic: z.string(),
  payload: z.record(z.string(), z.unknown()),
})), async (c) => {
  const { topic, payload } = c.req.valid('json');
  const event = { id: crypto.randomUUID(), topic, payload: payload as Record<string, unknown>, timestamp: new Date() };
  eventHistory.push(event);
  
  // 模拟触发订阅
  const matchedSubs = Array.from(subscriptions.values()).filter(s => s.topic === topic && s.enabled);
  
  return c.json({ code: 0, message: `事件已发布，触发${matchedSubs.length}个订阅` });
});

// 获取事件历史
eventBusRoutes.get('/history', authMiddleware, async (c) => {
  const topic = c.req.query('topic');
  const limit = parseInt(c.req.query('limit') || '50');
  let result = [...eventHistory].reverse();
  if (topic) result = result.filter(e => e.topic === topic);
  return c.json({ code: 0, data: result.slice(0, limit) });
});

// 事件统计
eventBusRoutes.get('/stats', authMiddleware, async (c) => {
  return c.json({
    code: 0,
    data: {
      totalTopics: topics.length,
      totalSubscriptions: subscriptions.size,
      activeSubscriptions: Array.from(subscriptions.values()).filter(s => s.enabled).length,
      totalEvents: eventHistory.length,
      eventsByTopic: Object.fromEntries(
        topics.map(t => [t.id, eventHistory.filter(e => e.topic === t.id).length])
      ),
    },
  });
});

export { eventBusRoutes };
