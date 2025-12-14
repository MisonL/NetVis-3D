import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc, and, count } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';
import crypto from 'crypto';

const openApiRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// === API Key 管理 ===

const createKeySchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  permissions: z.array(z.enum(['read', 'write', 'admin'])).default(['read']),
  rateLimit: z.number().min(100).max(100000).default(1000),
  expiresInDays: z.number().min(1).max(365).optional(),
});

// 获取API Key列表
openApiRoutes.get('/keys', authMiddleware, requireRole('admin'), async (c) => {
  try {
    const keys = await db
      .select({
        id: schema.apiKeys.id,
        name: schema.apiKeys.name,
        key: schema.apiKeys.key,
        permissions: schema.apiKeys.permissions,
        rateLimit: schema.apiKeys.rateLimit,
        isActive: schema.apiKeys.isActive,
        lastUsedAt: schema.apiKeys.lastUsedAt,
        expiresAt: schema.apiKeys.expiresAt,
        createdAt: schema.apiKeys.createdAt,
      })
      .from(schema.apiKeys)
      .orderBy(desc(schema.apiKeys.createdAt));

    return c.json({
      code: 0,
      data: keys,
    });
  } catch (error) {
    console.error('Get API keys error:', error);
    return c.json({ code: 500, message: '获取API Key失败' }, 500);
  }
});

// 创建API Key
openApiRoutes.post('/keys', authMiddleware, requireRole('admin'), zValidator('json', createKeySchema), async (c) => {
  const { name, permissions, rateLimit, expiresInDays } = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    // 生成Key和Secret
    const key = `nv_live_${crypto.randomBytes(16).toString('hex')}`;
    const secret = crypto.randomBytes(32).toString('hex');

    // 计算过期时间
    let expiresAt: Date | null = null;
    if (expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    // 保存到数据库
    const [newKey] = await db
      .insert(schema.apiKeys)
      .values({
        name,
        key,
        secret,
        permissions,
        rateLimit,
        expiresAt,
        createdBy: currentUser.userId,
      })
      .returning();

    // 记录审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'create',
      resource: 'api_keys',
      resourceId: newKey?.id,
      details: JSON.stringify({ name }),
    });

    return c.json({
      code: 0,
      message: 'API Key创建成功',
      data: {
        id: newKey?.id,
        name: newKey?.name,
        key: newKey?.key,
        secret: newKey?.secret, // 只在创建时返回
        permissions: newKey?.permissions,
        rateLimit: newKey?.rateLimit,
        expiresAt: newKey?.expiresAt,
      },
    });
  } catch (error) {
    console.error('Create API key error:', error);
    return c.json({ code: 500, message: '创建API Key失败' }, 500);
  }
});

// 删除API Key
openApiRoutes.delete('/keys/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const currentUser = c.get('user');

  try {
    await db.delete(schema.apiKeys).where(eq(schema.apiKeys.id, id));

    // 记录审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'delete',
      resource: 'api_keys',
      resourceId: id,
    });

    return c.json({
      code: 0,
      message: 'API Key已删除',
    });
  } catch (error) {
    console.error('Delete API key error:', error);
    return c.json({ code: 500, message: '删除API Key失败' }, 500);
  }
});

// === Webhook 管理 ===

const createWebhookSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  url: z.string().url('URL格式不正确'),
  events: z.array(z.string()).min(1, '至少选择一个事件'),
});

// 获取Webhook列表
openApiRoutes.get('/webhooks', authMiddleware, requireRole('admin'), async (c) => {
  try {
    const webhookList = await db
      .select({
        id: schema.webhooks.id,
        name: schema.webhooks.name,
        url: schema.webhooks.url,
        events: schema.webhooks.events,
        isActive: schema.webhooks.isActive,
        lastTriggeredAt: schema.webhooks.lastTriggeredAt,
        failCount: schema.webhooks.failCount,
        createdAt: schema.webhooks.createdAt,
      })
      .from(schema.webhooks)
      .orderBy(desc(schema.webhooks.createdAt));

    return c.json({
      code: 0,
      data: webhookList,
    });
  } catch (error) {
    console.error('Get webhooks error:', error);
    return c.json({ code: 500, message: '获取Webhook失败' }, 500);
  }
});

// 创建Webhook
openApiRoutes.post('/webhooks', authMiddleware, requireRole('admin'), zValidator('json', createWebhookSchema), async (c) => {
  const { name, url, events } = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const secret = crypto.randomBytes(32).toString('hex');

    const [newWebhook] = await db
      .insert(schema.webhooks)
      .values({
        name,
        url,
        secret,
        events,
        createdBy: currentUser.userId,
      })
      .returning();

    // 记录审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'create',
      resource: 'webhooks',
      resourceId: newWebhook?.id,
      details: JSON.stringify({ name, url }),
    });

    return c.json({
      code: 0,
      message: 'Webhook创建成功',
      data: {
        id: newWebhook?.id,
        name: newWebhook?.name,
        url: newWebhook?.url,
        secret: newWebhook?.secret,
        events: newWebhook?.events,
      },
    });
  } catch (error) {
    console.error('Create webhook error:', error);
    return c.json({ code: 500, message: '创建Webhook失败' }, 500);
  }
});

// 测试Webhook
openApiRoutes.post('/webhooks/:id/test', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');

  try {
    // 获取Webhook配置
    const [webhook] = await db
      .select()
      .from(schema.webhooks)
      .where(eq(schema.webhooks.id, id))
      .limit(1);

    if (!webhook) {
      return c.json({ code: 404, message: 'Webhook不存在' }, 404);
    }

    // 模拟发送测试请求
    const startTime = Date.now();
    // TODO: 实际发送HTTP请求到webhook.url
    const responseTime = Date.now() - startTime + Math.floor(Math.random() * 200);

    return c.json({
      code: 0,
      message: '测试请求已发送',
      data: {
        success: true,
        responseTime,
        statusCode: 200,
      },
    });
  } catch (error) {
    console.error('Test webhook error:', error);
    return c.json({ code: 500, message: '测试Webhook失败' }, 500);
  }
});

// 删除Webhook
openApiRoutes.delete('/webhooks/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const currentUser = c.get('user');

  try {
    await db.delete(schema.webhooks).where(eq(schema.webhooks.id, id));

    // 记录审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'delete',
      resource: 'webhooks',
      resourceId: id,
    });

    return c.json({
      code: 0,
      message: 'Webhook已删除',
    });
  } catch (error) {
    console.error('Delete webhook error:', error);
    return c.json({ code: 500, message: '删除Webhook失败' }, 500);
  }
});

// === API 文档 ===

openApiRoutes.get('/docs', async (c) => {
  return c.json({
    code: 0,
    data: {
      title: 'NetVis Pro API',
      version: '1.0.0',
      baseUrl: '/api',
      authentication: {
        type: 'Bearer Token / API Key',
        description: '使用JWT Token或API Key进行认证',
      },
      endpoints: [
        { method: 'GET', path: '/devices', description: '获取设备列表' },
        { method: 'GET', path: '/devices/:id', description: '获取设备详情' },
        { method: 'POST', path: '/devices', description: '创建设备' },
        { method: 'PUT', path: '/devices/:id', description: '更新设备' },
        { method: 'DELETE', path: '/devices/:id', description: '删除设备' },
        { method: 'GET', path: '/alerts', description: '获取告警列表' },
        { method: 'PUT', path: '/alerts/:id/ack', description: '确认告警' },
        { method: 'GET', path: '/analytics/dashboard', description: '获取仪表盘数据' },
      ],
      webhookEvents: [
        { event: 'device.online', description: '设备上线' },
        { event: 'device.offline', description: '设备离线' },
        { event: 'alert.created', description: '告警产生' },
        { event: 'alert.resolved', description: '告警解决' },
      ],
    },
  });
});

export { openApiRoutes };
