import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const tenantRoutes = new Hono<{ Variables: { user: JwtPayload } }>();

// 租户存储
const tenants = new Map<string, {
  id: string;
  name: string;
  code: string;
  domain: string;
  logo?: string;
  contact: string;
  email: string;
  phone: string;
  maxDevices: number;
  maxUsers: number;
  status: 'active' | 'suspended' | 'trial';
  expireAt?: Date;
  createdAt: Date;
}>();

// 租户配额使用
const tenantUsage = new Map<string, {
  deviceCount: number;
  userCount: number;
  storageUsed: number;
  apiCalls: number;
}>();

// 初始化示例数据
[
  { id: 'tenant-1', name: '主租户', code: 'MAIN', domain: 'main.netvis.local', contact: '管理员', email: 'admin@main.com', phone: '13800000001', maxDevices: 1000, maxUsers: 50, status: 'active' as const },
  { id: 'tenant-2', name: '分支机构A', code: 'BRANCH-A', domain: 'brancha.netvis.local', contact: '张经理', email: 'zhang@brancha.com', phone: '13800000002', maxDevices: 200, maxUsers: 10, status: 'active' as const },
  { id: 'tenant-3', name: '试用租户', code: 'TRIAL-001', domain: 'trial.netvis.local', contact: '李先生', email: 'li@trial.com', phone: '13800000003', maxDevices: 50, maxUsers: 5, status: 'trial' as const, expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
].forEach(t => {
  tenants.set(t.id, { ...t, createdAt: new Date() });
  tenantUsage.set(t.id, { deviceCount: 0, userCount: 0, storageUsed: 0, apiCalls: 0 });
});

// 获取租户列表
tenantRoutes.get('/', authMiddleware, requireRole('admin'), async (c) => {
  const list = Array.from(tenants.values()).map(t => ({
    ...t,
    usage: tenantUsage.get(t.id),
  }));
  return c.json({ code: 0, data: list });
});

// 获取租户详情
tenantRoutes.get('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const tenant = tenants.get(id);
  if (!tenant) return c.json({ code: 404, message: '租户不存在' }, 404);
  return c.json({ code: 0, data: { ...tenant, usage: tenantUsage.get(id) } });
});

// 创建租户
tenantRoutes.post('/', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  name: z.string(),
  code: z.string(),
  domain: z.string(),
  contact: z.string(),
  email: z.string().email(),
  phone: z.string(),
  maxDevices: z.number(),
  maxUsers: z.number(),
})), async (c) => {
  const data = c.req.valid('json');
  const id = crypto.randomUUID();
  tenants.set(id, { id, ...data, status: 'active', createdAt: new Date() });
  tenantUsage.set(id, { deviceCount: 0, userCount: 0, storageUsed: 0, apiCalls: 0 });
  return c.json({ code: 0, message: '租户已创建', data: { id } });
});

// 更新租户
tenantRoutes.put('/:id', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  name: z.string().optional(),
  maxDevices: z.number().optional(),
  maxUsers: z.number().optional(),
  status: z.enum(['active', 'suspended', 'trial']).optional(),
})), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');
  const tenant = tenants.get(id);
  if (!tenant) return c.json({ code: 404, message: '租户不存在' }, 404);
  Object.assign(tenant, data);
  return c.json({ code: 0, message: '租户已更新' });
});

// 删除租户
tenantRoutes.delete('/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  if (!tenants.has(id)) return c.json({ code: 404, message: '租户不存在' }, 404);
  tenants.delete(id);
  tenantUsage.delete(id);
  return c.json({ code: 0, message: '租户已删除' });
});

// 暂停/恢复租户
tenantRoutes.post('/:id/toggle', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const tenant = tenants.get(id);
  if (!tenant) return c.json({ code: 404, message: '租户不存在' }, 404);
  tenant.status = tenant.status === 'suspended' ? 'active' : 'suspended';
  return c.json({ code: 0, message: tenant.status === 'active' ? '已恢复' : '已暂停' });
});

// 租户统计
tenantRoutes.get('/stats/overview', authMiddleware, requireRole('admin'), async (c) => {
  const allTenants = Array.from(tenants.values());
  const allUsage = Array.from(tenantUsage.values());
  return c.json({
    code: 0,
    data: {
      total: allTenants.length,
      active: allTenants.filter(t => t.status === 'active').length,
      suspended: allTenants.filter(t => t.status === 'suspended').length,
      trial: allTenants.filter(t => t.status === 'trial').length,
      totalDevices: allUsage.reduce((s, u) => s + u.deviceCount, 0),
      totalUsers: allUsage.reduce((s, u) => s + u.userCount, 0),
      totalStorage: (allUsage.reduce((s, u) => s + u.storageUsed, 0) / 1024 / 1024 / 1024).toFixed(2) + ' GB',
    },
  });
});

export { tenantRoutes };
