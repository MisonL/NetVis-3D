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

// SNMP模板存储（实际应使用数据库）
const snmpTemplates = new Map<string, {
  id: string;
  name: string;
  vendor: string;
  version: 'v1' | 'v2c' | 'v3';
  community?: string;
  securityLevel?: string;
  authProtocol?: string;
  privProtocol?: string;
  oids: {
    name: string;
    oid: string;
    type: 'gauge' | 'counter' | 'string';
    description?: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}>();

// 初始化默认模板
const defaultTemplates = [
  {
    id: '1',
    name: 'Cisco 通用模板',
    vendor: 'Cisco',
    version: 'v2c' as const,
    community: 'public',
    oids: [
      { name: 'sysDescr', oid: '1.3.6.1.2.1.1.1.0', type: 'string' as const, description: '系统描述' },
      { name: 'sysUpTime', oid: '1.3.6.1.2.1.1.3.0', type: 'counter' as const, description: '运行时间' },
      { name: 'ifInOctets', oid: '1.3.6.1.2.1.2.2.1.10', type: 'counter' as const, description: '入流量' },
      { name: 'ifOutOctets', oid: '1.3.6.1.2.1.2.2.1.16', type: 'counter' as const, description: '出流量' },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    name: 'Huawei 交换机模板',
    vendor: 'Huawei',
    version: 'v2c' as const,
    community: 'public',
    oids: [
      { name: 'hwMemoryUsage', oid: '1.3.6.1.4.1.2011.6.3.17.1.1.3', type: 'gauge' as const, description: '内存使用率' },
      { name: 'hwCpuUsage', oid: '1.3.6.1.4.1.2011.6.3.4.1.2', type: 'gauge' as const, description: 'CPU使用率' },
      { name: 'hwTemperature', oid: '1.3.6.1.4.1.2011.6.3.13.1.1.3', type: 'gauge' as const, description: '温度' },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '3',
    name: 'Linux 服务器模板',
    vendor: 'Linux',
    version: 'v2c' as const,
    community: 'public',
    oids: [
      { name: 'hrProcessorLoad', oid: '1.3.6.1.2.1.25.3.3.1.2', type: 'gauge' as const, description: 'CPU负载' },
      { name: 'hrStorageUsed', oid: '1.3.6.1.2.1.25.2.3.1.6', type: 'gauge' as const, description: '存储使用' },
      { name: 'hrMemorySize', oid: '1.3.6.1.2.1.25.2.2.0', type: 'gauge' as const, description: '内存大小' },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

defaultTemplates.forEach(t => snmpTemplates.set(t.id, t));

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
    const templates = Array.from(snmpTemplates.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return c.json({
      code: 0,
      data: templates,
    });
  } catch (error) {
    console.error('Get SNMP templates error:', error);
    return c.json({ code: 500, message: '获取模板列表失败' }, 500);
  }
});

// 获取单个模板
snmpRoutes.get('/templates/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  
  try {
    const template = snmpTemplates.get(id);
    if (!template) {
      return c.json({ code: 404, message: '模板不存在' }, 404);
    }

    return c.json({ code: 0, data: template });
  } catch (error) {
    return c.json({ code: 500, message: '获取模板失败' }, 500);
  }
});

// 创建模板
snmpRoutes.post('/templates', authMiddleware, requireRole('admin'), zValidator('json', templateSchema), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const id = crypto.randomUUID();
    const template = {
      id,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    snmpTemplates.set(id, template);

    // 审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'create',
      resource: 'snmp_templates',
      resourceId: id,
      details: JSON.stringify({ name: data.name }),
    });

    return c.json({
      code: 0,
      message: '模板创建成功',
      data: template,
    });
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
    const template = snmpTemplates.get(id);
    if (!template) {
      return c.json({ code: 404, message: '模板不存在' }, 404);
    }

    const updated = {
      ...template,
      ...data,
      updatedAt: new Date(),
    };

    snmpTemplates.set(id, updated);

    return c.json({ code: 0, message: '模板更新成功' });
  } catch (error) {
    console.error('Update SNMP template error:', error);
    return c.json({ code: 500, message: '更新模板失败' }, 500);
  }
});

// 删除模板
snmpRoutes.delete('/templates/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');

  try {
    if (!snmpTemplates.has(id)) {
      return c.json({ code: 404, message: '模板不存在' }, 404);
    }

    snmpTemplates.delete(id);
    return c.json({ code: 0, message: '模板删除成功' });
  } catch (error) {
    console.error('Delete SNMP template error:', error);
    return c.json({ code: 500, message: '删除模板失败' }, 500);
  }
});

// 测试SNMP连接
snmpRoutes.post('/test', authMiddleware, zValidator('json', z.object({
  ip: z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, "IP格式不正确"),
  version: z.enum(['v1', 'v2c', 'v3']),
  community: z.string().optional(),
  oid: z.string().optional(),
})), async (c) => {
  const { ip, version, community, oid } = c.req.valid('json');

  try {
    // 模拟SNMP测试
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 返回模拟结果
    return c.json({
      code: 0,
      message: 'SNMP连接成功',
      data: {
        ip,
        version,
        success: true,
        responseTime: Math.random() * 100 + 50,
        sysDescr: 'Cisco IOS Software, Catalyst 2960 Software',
        sysUpTime: 86400 * 30,
      },
    });
  } catch (error) {
    console.error('SNMP test error:', error);
    return c.json({ code: 500, message: 'SNMP连接失败' }, 500);
  }
});

export { snmpRoutes };
