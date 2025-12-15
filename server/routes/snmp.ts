import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const snmpRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

import snmp from 'net-snmp';

// 模板Schema
const templateSchema = z.object({
  name: z.string().min(1, '模板名称不能为空'),
  vendor: z.string(),
  version: z.enum(['v1', 'v2c', 'v3']),
  community: z.string().optional(),
  securityLevel: z.string().optional(),
  authProtocol: z.string().optional(),
  privProtocol: z.string().optional(),
  oids: z.array(z.object({
    name: z.string(),
    oid: z.string(),
    type: z.enum(['gauge', 'counter', 'string']),
    description: z.string().optional(),
  })),
});

// 获取模板列表
snmpRoutes.get('/templates', authMiddleware, async (c) => {
  try {
    const templates = await db.select().from(schema.snmpTemplates).orderBy(desc(schema.snmpTemplates.createdAt));
    return c.json({ code: 0, data: templates.map(t => ({...t, oids: JSON.parse(t.oids)})) }); // Parse JSON oids
  } catch (error) {
    console.error('Get SNMP templates error:', error);
    return c.json({ code: 500, message: '获取模板列表失败' }, 500);
  }
});

// 获取单个模板
snmpRoutes.get('/templates/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  try {
    const result = await db.select().from(schema.snmpTemplates).where(eq(schema.snmpTemplates.id, id));
    const template = result[0];
    if (!template) return c.json({ code: 404, message: '模板不存在' }, 404);
    return c.json({ code: 0, data: {...template, oids: JSON.parse(template.oids)} });
  } catch (error) { return c.json({ code: 500, message: '获取模板失败' }, 500); }
});

// 创建模板
snmpRoutes.post('/templates', authMiddleware, requireRole('admin'), zValidator('json', templateSchema), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');
  try {
    const [template] = await db.insert(schema.snmpTemplates).values({
        name: data.name,
        vendor: data.vendor,
        version: data.version,
        community: data.community,
        securityLevel: data.securityLevel,
        authProtocol: data.authProtocol,
        privProtocol: data.privProtocol,
        oids: JSON.stringify(data.oids),
    }).returning();

    if (!template) throw new Error('Failed to create template');

    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId, action: 'create', resource: 'snmp_templates', resourceId: template.id, details: JSON.stringify({ name: data.name }),
    });

    return c.json({ code: 0, message: '模板创建成功', data: {...template, oids: JSON.parse(template.oids)} });
  } catch (error) {
    console.error('Create SNMP template error:', error);
    return c.json({ code: 500, message: '创建模板失败' }, 500);
  }
});

// 更新模板
snmpRoutes.put('/templates/:id', authMiddleware, requireRole('admin'), zValidator('json', templateSchema.partial()), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');
  try {
    const [existing] = await db.select().from(schema.snmpTemplates).where(eq(schema.snmpTemplates.id, id));
    if (!existing) return c.json({ code: 404, message: '模板不存在' }, 404);

    if (data.oids) (data as any).oids = JSON.stringify(data.oids); // Convert to string

    await db.update(schema.snmpTemplates).set({ ...data, updatedAt: new Date() } as any).where(eq(schema.snmpTemplates.id, id));
    return c.json({ code: 0, message: '模板更新成功' });
  } catch (error) { return c.json({ code: 500, message: '更新模板失败' }, 500); }
});

// 删除模板
snmpRoutes.delete('/templates/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  try {
    const res = await db.delete(schema.snmpTemplates).where(eq(schema.snmpTemplates.id, id)).returning();
    if (res.length === 0) return c.json({ code: 404, message: '模板不存在' }, 404);
    return c.json({ code: 0, message: '模板删除成功' });
  } catch (error) { return c.json({ code: 500, message: '删除模板失败' }, 500); }
});

// 测试SNMP连接 (Real)
snmpRoutes.post('/test', authMiddleware, zValidator('json', z.object({
  ip: z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, "IP格式不正确"),
  version: z.enum(['v1', 'v2c', 'v3']),
  community: z.string().optional(),
  oid: z.string().optional(),
})), async (c) => {
  const { ip, version, community = 'public', oid = '1.3.6.1.2.1.1.1.0' } = c.req.valid('json');

  try {
      const options = {
          port: 161,
          retries: 1,
          timeout: 2000,
          version: version === 'v1' ? snmp.Version1 : version === 'v2c' ? snmp.Version2c : snmp.Version3
      };
      
      // TODO: Handle V3 users if needed. For now assuming v2c/v1 community
      const session = snmp.createSession(ip, community, options);
      
      const result: any = await new Promise((resolve, reject) => {
          const start = Date.now();
          session.get([oid], (error: Error | null, varbinds: any[]) => {
              if (error) {
                  return reject(error);
              }
              if (snmp.isVarbindError(varbinds[0])) {
                  return reject(new Error(snmp.varbindError(varbinds[0])));
              }
              resolve({
                  ip, version, success: true, responseTime: Date.now() - start,
                  value: varbinds[0].value.toString(),
                  oid: varbinds[0].oid
              });
          });
      });
      
      session.close();

    return c.json({ code: 0, message: 'SNMP连接成功', data: result });
  } catch (error: any) {
    console.error('SNMP test error:', error);
    return c.json({ code: 500, message: `SNMP连接失败: ${error.message}` }, 500);
  }
});

export { snmpRoutes };
