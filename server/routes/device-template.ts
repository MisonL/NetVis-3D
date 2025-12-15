import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const deviceTemplateRoutes = new Hono<{ Variables: { user: JwtPayload } }>();

// 设备模板存储
const templates = new Map<string, {
  id: string;
  name: string;
  vendor: string;
  model: string;
  type: string;
  snmpOid: string[];
  sshCommands: string[];
  metrics: { name: string; oid: string; unit: string }[];
  createdAt: Date;
}>();

// 初始化示例模板
[
  { id: 'tpl-1', name: 'Cisco交换机模板', vendor: 'Cisco', model: 'Catalyst 9300', type: 'switch', snmpOid: ['1.3.6.1.2.1.1.1', '1.3.6.1.2.1.1.3'], sshCommands: ['show version', 'show interfaces'], metrics: [{ name: 'CPU', oid: '1.3.6.1.4.1.9.9.109.1.1.1.1.3', unit: '%' }] },
  { id: 'tpl-2', name: 'Huawei交换机模板', vendor: 'Huawei', model: 'S5720', type: 'switch', snmpOid: ['1.3.6.1.2.1.1.1'], sshCommands: ['display version'], metrics: [{ name: 'CPU', oid: '1.3.6.1.4.1.2011.5.25.31.1.1.1.1.5', unit: '%' }] },
  { id: 'tpl-3', name: 'H3C交换机模板', vendor: 'H3C', model: 'S6520', type: 'switch', snmpOid: ['1.3.6.1.2.1.1.1'], sshCommands: ['display version'], metrics: [] },
].forEach(t => templates.set(t.id, { ...t, createdAt: new Date() }));

// 获取模板列表
deviceTemplateRoutes.get('/', authMiddleware, async (c) => {
  const vendor = c.req.query('vendor');
  let list = Array.from(templates.values());
  if (vendor) list = list.filter(t => t.vendor === vendor);
  return c.json({ code: 0, data: list });
});

// 获取模板详情
deviceTemplateRoutes.get('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const template = templates.get(id);
  if (!template) return c.json({ code: 404, message: '模板不存在' }, 404);
  return c.json({ code: 0, data: template });
});

// 创建模板
deviceTemplateRoutes.post('/', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  name: z.string(),
  vendor: z.string(),
  model: z.string(),
  type: z.string(),
  snmpOid: z.array(z.string()).optional(),
  sshCommands: z.array(z.string()).optional(),
  metrics: z.array(z.object({ name: z.string(), oid: z.string(), unit: z.string() })).optional(),
})), async (c) => {
  const data = c.req.valid('json');
  const id = crypto.randomUUID();
  templates.set(id, { id, ...data, snmpOid: data.snmpOid || [], sshCommands: data.sshCommands || [], metrics: data.metrics || [], createdAt: new Date() });
  return c.json({ code: 0, message: '模板已创建', data: { id } });
});

// 更新模板
deviceTemplateRoutes.put('/:id', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  name: z.string().optional(),
  snmpOid: z.array(z.string()).optional(),
  sshCommands: z.array(z.string()).optional(),
  metrics: z.array(z.object({ name: z.string(), oid: z.string(), unit: z.string() })).optional(),
})), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');
  const template = templates.get(id);
  if (!template) return c.json({ code: 404, message: '模板不存在' }, 404);
  Object.assign(template, data);
  return c.json({ code: 0, message: '模板已更新' });
});

// 删除模板
deviceTemplateRoutes.delete('/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  if (!templates.has(id)) return c.json({ code: 404, message: '模板不存在' }, 404);
  templates.delete(id);
  return c.json({ code: 0, message: '模板已删除' });
});

// 克隆模板
deviceTemplateRoutes.post('/:id/clone', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const template = templates.get(id);
  if (!template) return c.json({ code: 404, message: '模板不存在' }, 404);
  
  const newId = crypto.randomUUID();
  templates.set(newId, { ...template, id: newId, name: `${template.name}(副本)`, createdAt: new Date() });
  return c.json({ code: 0, message: '模板已克隆', data: { id: newId } });
});

// 应用模板到设备
deviceTemplateRoutes.post('/:id/apply', authMiddleware, zValidator('json', z.object({
  deviceIds: z.array(z.string()),
})), async (c) => {
  const id = c.req.param('id');
  const { deviceIds } = c.req.valid('json');
  const template = templates.get(id);
  if (!template) return c.json({ code: 404, message: '模板不存在' }, 404);
  
  // 模拟应用
  return c.json({ code: 0, message: `模板已应用到${deviceIds.length}台设备` });
});

// 厂商列表
deviceTemplateRoutes.get('/vendors/list', authMiddleware, async (c) => {
  const vendors = [...new Set(Array.from(templates.values()).map(t => t.vendor))];
  return c.json({ code: 0, data: vendors });
});

export { deviceTemplateRoutes };
