import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const rateLimitRoutes = new Hono<{ Variables: { user: JwtPayload } }>();

// 限流规则
const rateLimits = new Map<string, {
  id: string;
  name: string;
  path: string;
  method: string;
  limit: number;
  window: number;
  enabled: boolean;
  hitCount: number;
  blockedCount: number;
  createdAt: Date;
}>();

// 限流统计
const rateLimitStats = {
  totalRequests: 1523456,
  blockedRequests: 2341,
  avgLatency: 45.6,
  peakRps: 1523,
};

// 初始化示例规则
[
  { id: 'rl-1', name: 'API全局限制', path: '/api/*', method: 'ALL', limit: 1000, window: 60, enabled: true, hitCount: 523456, blockedCount: 1234 },
  { id: 'rl-2', name: '登录限制', path: '/api/auth/login', method: 'POST', limit: 5, window: 60, enabled: true, hitCount: 8234, blockedCount: 523 },
  { id: 'rl-3', name: '设备查询', path: '/api/devices', method: 'GET', limit: 100, window: 60, enabled: true, hitCount: 123456, blockedCount: 234 },
].forEach(r => rateLimits.set(r.id, { ...r, createdAt: new Date() }));

// 获取限流规则
rateLimitRoutes.get('/rules', authMiddleware, async (c) => {
  return c.json({ code: 0, data: Array.from(rateLimits.values()) });
});

// 创建限流规则
rateLimitRoutes.post('/rules', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  name: z.string(),
  path: z.string(),
  method: z.string(),
  limit: z.number(),
  window: z.number(),
})), async (c) => {
  const data = c.req.valid('json');
  const id = crypto.randomUUID();
  rateLimits.set(id, { id, ...data, enabled: true, hitCount: 0, blockedCount: 0, createdAt: new Date() });
  return c.json({ code: 0, message: '规则已创建', data: { id } });
});

// 删除规则
rateLimitRoutes.delete('/rules/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  if (!rateLimits.has(id)) return c.json({ code: 404, message: '规则不存在' }, 404);
  rateLimits.delete(id);
  return c.json({ code: 0, message: '规则已删除' });
});

// 启用/禁用规则
rateLimitRoutes.post('/rules/:id/toggle', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const rule = rateLimits.get(id);
  if (!rule) return c.json({ code: 404, message: '规则不存在' }, 404);
  rule.enabled = !rule.enabled;
  return c.json({ code: 0, message: rule.enabled ? '已启用' : '已禁用' });
});

// 限流统计
rateLimitRoutes.get('/stats', authMiddleware, async (c) => {
  const rules = Array.from(rateLimits.values());
  return c.json({
    code: 0,
    data: {
      ...rateLimitStats,
      rulesCount: rules.length,
      enabledRules: rules.filter(r => r.enabled).length,
      totalBlocked: rules.reduce((s, r) => s + r.blockedCount, 0),
      topBlocked: rules.sort((a, b) => b.blockedCount - a.blockedCount).slice(0, 5),
    },
  });
});

// 实时流量
rateLimitRoutes.get('/realtime', authMiddleware, async (c) => {
  // 模拟实时流量数据
  const data = Array.from({ length: 60 }, (_, i) => ({
    time: new Date(Date.now() - (59 - i) * 1000).toISOString(),
    requests: Math.floor(Math.random() * 200 + 100),
    blocked: Math.floor(Math.random() * 10),
  }));
  return c.json({ code: 0, data });
});

export { rateLimitRoutes };
