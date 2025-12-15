import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const slaRoutes = new Hono<{ Variables: { user: JwtPayload } }>();

// SLA策略存储
const slaPolicies = new Map<string, {
  id: string;
  name: string;
  description: string;
  availabilityTarget: number;
  latencyTarget: number;
  mttrTarget: number;
  isDefault: boolean;
  createdAt: Date;
}>();

// SLA报告
const slaReports: {
  id: string;
  policyId: string;
  period: string;
  availability: number;
  avgLatency: number;
  mttr: string;
  status: 'met' | 'breached';
  generatedAt: Date;
}[] = [];

// 初始化示例策略
[
  { id: 'sla-1', name: '黄金级', description: '核心业务SLA', availabilityTarget: 99.99, latencyTarget: 10, mttrTarget: 15, isDefault: false },
  { id: 'sla-2', name: '白银级', description: '重要业务SLA', availabilityTarget: 99.9, latencyTarget: 30, mttrTarget: 60, isDefault: true },
  { id: 'sla-3', name: '青铜级', description: '一般业务SLA', availabilityTarget: 99.5, latencyTarget: 100, mttrTarget: 240, isDefault: false },
].forEach(p => slaPolicies.set(p.id, { ...p, createdAt: new Date() }));

// 获取SLA策略列表
slaRoutes.get('/policies', authMiddleware, async (c) => {
  return c.json({ code: 0, data: Array.from(slaPolicies.values()) });
});

// 创建SLA策略
slaRoutes.post('/policies', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  name: z.string().min(1),
  description: z.string(),
  availabilityTarget: z.number().min(90).max(100),
  latencyTarget: z.number().min(1),
  mttrTarget: z.number().min(1),
})), async (c) => {
  const data = c.req.valid('json');
  const id = crypto.randomUUID();
  slaPolicies.set(id, { id, ...data, isDefault: false, createdAt: new Date() });
  return c.json({ code: 0, message: 'SLA策略已创建', data: { id } });
});

// 更新SLA策略
slaRoutes.put('/policies/:id', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  availabilityTarget: z.number().optional(),
  latencyTarget: z.number().optional(),
  mttrTarget: z.number().optional(),
})), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');
  const policy = slaPolicies.get(id);
  if (!policy) return c.json({ code: 404, message: '策略不存在' }, 404);
  Object.assign(policy, data);
  return c.json({ code: 0, message: 'SLA策略已更新' });
});

// 删除SLA策略
slaRoutes.delete('/policies/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  if (!slaPolicies.has(id)) return c.json({ code: 404, message: '策略不存在' }, 404);
  slaPolicies.delete(id);
  return c.json({ code: 0, message: 'SLA策略已删除' });
});

// 获取SLA报告列表
slaRoutes.get('/reports', authMiddleware, async (c) => {
  // 生成模拟报告
  const policies = Array.from(slaPolicies.values());
  const reports = policies.map(p => ({
    id: `report-${p.id}`,
    policyId: p.id,
    policyName: p.name,
    period: new Date().toISOString().slice(0, 7),
    availability: p.availabilityTarget - Math.random() * 0.5,
    avgLatency: Math.floor(Math.random() * 20 + 5),
    mttr: `${Math.floor(Math.random() * 30 + 10)}min`,
    status: Math.random() > 0.2 ? 'met' : 'breached',
    generatedAt: new Date(),
  }));
  return c.json({ code: 0, data: reports });
});

// 获取SLA仪表盘数据
slaRoutes.get('/dashboard', authMiddleware, async (c) => {
  const policies = Array.from(slaPolicies.values());
  const dashboard = {
    totalPolicies: policies.length,
    metCount: Math.floor(policies.length * 0.8),
    breachedCount: Math.ceil(policies.length * 0.2),
    avgAvailability: 99.85,
    avgLatency: 15,
    currentMTTR: '25min',
    trends: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      availability: 99.5 + Math.random() * 0.4,
      latency: Math.floor(Math.random() * 20 + 10),
    })),
  };
  return c.json({ code: 0, data: dashboard });
});

export { slaRoutes };
