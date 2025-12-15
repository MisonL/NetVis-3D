import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const changeManagementRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 变更请求存储
const changeRequests = new Map<string, {
  id: string;
  title: string;
  description: string;
  type: 'config' | 'firmware' | 'network' | 'security';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'implemented' | 'rollback';
  affectedDevices: string[];
  rollbackPlan: string;
  scheduledAt?: Date;
  implementedAt?: Date;
  createdBy: string;
  approvedBy?: string;
  createdAt: Date;
}>();

// 初始化示例数据
const sampleChanges = [
  { id: 'chg-1', title: '核心交换机ACL更新', description: '更新核心交换机的访问控制列表', type: 'security' as const, priority: 'high' as const, status: 'pending' as const, affectedDevices: ['dev-1', 'dev-2'], rollbackPlan: '回退到之前的ACL配置', createdBy: 'admin' },
  { id: 'chg-2', title: 'OSPF区域调整', description: '调整OSPF路由区域配置', type: 'network' as const, priority: 'medium' as const, status: 'approved' as const, affectedDevices: ['dev-3'], rollbackPlan: '恢复原OSPF配置', createdBy: 'admin', approvedBy: 'manager' },
];
sampleChanges.forEach(chg => changeRequests.set(chg.id, { ...chg, createdAt: new Date() }));

// 获取变更请求列表
changeManagementRoutes.get('/', authMiddleware, async (c) => {
  const status = c.req.query('status');
  let changes = Array.from(changeRequests.values());
  if (status) changes = changes.filter(ch => ch.status === status);
  return c.json({ code: 0, data: changes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) });
});

// 创建变更请求
changeManagementRoutes.post('/', authMiddleware, zValidator('json', z.object({
  title: z.string().min(1),
  description: z.string(),
  type: z.enum(['config', 'firmware', 'network', 'security']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  affectedDevices: z.array(z.string()),
  rollbackPlan: z.string(),
  scheduledAt: z.string().optional(),
})), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const id = crypto.randomUUID();
    changeRequests.set(id, {
      id,
      title: data.title,
      description: data.description,
      type: data.type,
      priority: data.priority,
      status: 'draft',
      affectedDevices: data.affectedDevices,
      rollbackPlan: data.rollbackPlan,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      createdBy: currentUser.userId,
      createdAt: new Date(),
    });

    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'create_change_request',
      resource: 'change',
      details: JSON.stringify({ changeId: id, title: data.title }),
    });

    return c.json({ code: 0, message: '变更请求已创建', data: { id } });
  } catch (error) {
    return c.json({ code: 500, message: '创建失败' }, 500);
  }
});

// 审批变更请求
changeManagementRoutes.post('/:id/approve', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const currentUser = c.get('user');
  const change = changeRequests.get(id);

  if (!change) return c.json({ code: 404, message: '变更请求不存在' }, 404);
  if (change.status !== 'pending') return c.json({ code: 400, message: '只能审批待审核的请求' }, 400);

  change.status = 'approved';
  change.approvedBy = currentUser.userId;

  await db.insert(schema.auditLogs).values({
    userId: currentUser.userId,
    action: 'approve_change',
    resource: 'change',
    details: JSON.stringify({ changeId: id }),
  });

  return c.json({ code: 0, message: '变更请求已批准' });
});

// 拒绝变更请求
changeManagementRoutes.post('/:id/reject', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  reason: z.string(),
})), async (c) => {
  const id = c.req.param('id');
  const { reason } = c.req.valid('json');
  const change = changeRequests.get(id);

  if (!change) return c.json({ code: 404, message: '变更请求不存在' }, 404);

  change.status = 'rejected';

  return c.json({ code: 0, message: '变更请求已拒绝' });
});

// 执行变更
changeManagementRoutes.post('/:id/implement', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const change = changeRequests.get(id);

  if (!change) return c.json({ code: 404, message: '变更请求不存在' }, 404);
  if (change.status !== 'approved') return c.json({ code: 400, message: '只能执行已批准的变更' }, 400);

  change.status = 'implemented';
  change.implementedAt = new Date();

  return c.json({ code: 0, message: '变更已执行' });
});

// 回滚变更
changeManagementRoutes.post('/:id/rollback', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const change = changeRequests.get(id);

  if (!change) return c.json({ code: 404, message: '变更请求不存在' }, 404);
  if (change.status !== 'implemented') return c.json({ code: 400, message: '只能回滚已执行的变更' }, 400);

  change.status = 'rollback';

  return c.json({ code: 0, message: '变更已回滚' });
});

// 提交审批
changeManagementRoutes.post('/:id/submit', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const change = changeRequests.get(id);

  if (!change) return c.json({ code: 404, message: '变更请求不存在' }, 404);
  if (change.status !== 'draft') return c.json({ code: 400, message: '只能提交草稿状态的请求' }, 400);

  change.status = 'pending';

  return c.json({ code: 0, message: '已提交审批' });
});

// 变更统计
changeManagementRoutes.get('/stats/summary', authMiddleware, async (c) => {
  const changes = Array.from(changeRequests.values());
  const stats = {
    total: changes.length,
    draft: changes.filter(ch => ch.status === 'draft').length,
    pending: changes.filter(ch => ch.status === 'pending').length,
    approved: changes.filter(ch => ch.status === 'approved').length,
    implemented: changes.filter(ch => ch.status === 'implemented').length,
    rejected: changes.filter(ch => ch.status === 'rejected').length,
    rollback: changes.filter(ch => ch.status === 'rollback').length,
  };

  return c.json({ code: 0, data: stats });
});

export { changeManagementRoutes };
