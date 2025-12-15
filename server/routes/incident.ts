import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const incidentRoutes = new Hono<{ Variables: { user: JwtPayload } }>();

// 故障工单存储
const incidents = new Map<string, {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  affectedDevices: string[];
  assignee?: string;
  rootCause?: string;
  resolution?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}>();

// 初始化示例数据
[
  { id: 'inc-1', title: '核心交换机端口故障', description: '端口GE0/0/1持续丢包', severity: 'high' as const, status: 'in_progress' as const, affectedDevices: ['dev-1'], assignee: 'admin', createdBy: 'system' },
  { id: 'inc-2', title: '链路抖动告警', description: '骨干链路延迟波动', severity: 'medium' as const, status: 'open' as const, affectedDevices: ['dev-2', 'dev-3'], createdBy: 'monitor' },
].forEach(inc => incidents.set(inc.id, { ...inc, createdAt: new Date(), updatedAt: new Date() }));

// 获取故障列表
incidentRoutes.get('/', authMiddleware, async (c) => {
  const status = c.req.query('status');
  let list = Array.from(incidents.values());
  if (status) list = list.filter(i => i.status === status);
  return c.json({ code: 0, data: list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) });
});

// 创建故障工单
incidentRoutes.post('/', authMiddleware, zValidator('json', z.object({
  title: z.string().min(1),
  description: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  affectedDevices: z.array(z.string()),
})), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  const id = crypto.randomUUID();
  incidents.set(id, {
    id,
    ...data,
    status: 'open',
    createdBy: currentUser.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.insert(schema.auditLogs).values({
    userId: currentUser.userId,
    action: 'create_incident',
    resource: 'incident',
    details: JSON.stringify({ incidentId: id, title: data.title }),
  });

  return c.json({ code: 0, message: '故障工单已创建', data: { id } });
});

// 分配工单
incidentRoutes.post('/:id/assign', authMiddleware, zValidator('json', z.object({
  assignee: z.string(),
})), async (c) => {
  const id = c.req.param('id');
  const { assignee } = c.req.valid('json');
  const incident = incidents.get(id);

  if (!incident) return c.json({ code: 404, message: '工单不存在' }, 404);
  
  incident.assignee = assignee;
  incident.status = 'in_progress';
  incident.updatedAt = new Date();

  return c.json({ code: 0, message: '工单已分配' });
});

// 解决工单
incidentRoutes.post('/:id/resolve', authMiddleware, zValidator('json', z.object({
  rootCause: z.string(),
  resolution: z.string(),
})), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');
  const incident = incidents.get(id);

  if (!incident) return c.json({ code: 404, message: '工单不存在' }, 404);
  
  incident.rootCause = data.rootCause;
  incident.resolution = data.resolution;
  incident.status = 'resolved';
  incident.resolvedAt = new Date();
  incident.updatedAt = new Date();

  return c.json({ code: 0, message: '工单已解决' });
});

// 关闭工单
incidentRoutes.post('/:id/close', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const incident = incidents.get(id);

  if (!incident) return c.json({ code: 404, message: '工单不存在' }, 404);
  
  incident.status = 'closed';
  incident.updatedAt = new Date();

  return c.json({ code: 0, message: '工单已关闭' });
});

// 故障统计
incidentRoutes.get('/stats', authMiddleware, async (c) => {
  const list = Array.from(incidents.values());
  return c.json({
    code: 0,
    data: {
      total: list.length,
      open: list.filter(i => i.status === 'open').length,
      inProgress: list.filter(i => i.status === 'in_progress').length,
      resolved: list.filter(i => i.status === 'resolved').length,
      mttr: '2h 15m', // 平均修复时间(模拟)
    },
  });
});

export { incidentRoutes };
