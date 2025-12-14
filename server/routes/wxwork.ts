import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const wechatRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 企业微信配置存储
let wechatConfig = {
  corpId: '',
  agentId: '',
  secret: '',
  enabled: false,
  webhookUrl: '',
  // JS-SDK配置
  jsApiTicket: '',
  jsApiTicketExpires: 0,
};

// 获取企业微信配置
wechatRoutes.get('/config', authMiddleware, requireRole('admin'), async (c) => {
  return c.json({
    code: 0,
    data: {
      corpId: wechatConfig.corpId,
      agentId: wechatConfig.agentId,
      enabled: wechatConfig.enabled,
      webhookUrl: wechatConfig.webhookUrl ? '已配置' : '未配置',
      hasSecret: !!wechatConfig.secret,
    },
  });
});

// 更新企业微信配置
wechatRoutes.put('/config', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  corpId: z.string().optional(),
  agentId: z.string().optional(),
  secret: z.string().optional(),
  enabled: z.boolean().optional(),
  webhookUrl: z.string().url().optional(),
})), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    if (data.corpId !== undefined) wechatConfig.corpId = data.corpId;
    if (data.agentId !== undefined) wechatConfig.agentId = data.agentId;
    if (data.secret !== undefined) wechatConfig.secret = data.secret;
    if (data.enabled !== undefined) wechatConfig.enabled = data.enabled;
    if (data.webhookUrl !== undefined) wechatConfig.webhookUrl = data.webhookUrl;

    // 审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'update_wechat_config',
      resource: 'wechat',
      details: JSON.stringify({ enabled: wechatConfig.enabled }),
    });

    return c.json({ code: 0, message: '配置更新成功' });
  } catch (error) {
    return c.json({ code: 500, message: '更新失败' }, 500);
  }
});

// 测试企业微信连接
wechatRoutes.post('/test', authMiddleware, requireRole('admin'), async (c) => {
  try {
    if (!wechatConfig.corpId || !wechatConfig.secret) {
      return c.json({ code: 400, message: '请先配置企业微信信息' }, 400);
    }

    // 模拟测试连接
    await new Promise(resolve => setTimeout(resolve, 500));

    return c.json({
      code: 0,
      message: '连接测试成功',
      data: {
        corpName: '测试企业',
        agentName: 'NetVis Pro',
        status: 'connected',
      },
    });
  } catch (error) {
    return c.json({ code: 500, message: '连接测试失败' }, 500);
  }
});

// 发送企业微信消息
wechatRoutes.post('/send', authMiddleware, zValidator('json', z.object({
  type: z.enum(['text', 'markdown', 'textcard']),
  toUser: z.array(z.string()).optional(),
  toParty: z.array(z.string()).optional(),
  content: z.string(),
  title: z.string().optional(),
  url: z.string().optional(),
})), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    if (!wechatConfig.enabled) {
      return c.json({ code: 400, message: '企业微信功能未启用' }, 400);
    }

    // 模拟发送消息
    await new Promise(resolve => setTimeout(resolve, 300));

    // 审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'send_wechat',
      resource: 'wechat',
      details: JSON.stringify({ type: data.type, toUser: data.toUser }),
    });

    return c.json({
      code: 0,
      message: '消息发送成功',
      data: { msgId: crypto.randomUUID() },
    });
  } catch (error) {
    return c.json({ code: 500, message: '发送失败' }, 500);
  }
});

// Webhook机器人发送
wechatRoutes.post('/webhook', authMiddleware, zValidator('json', z.object({
  msgtype: z.enum(['text', 'markdown', 'image']),
  text: z.object({ content: z.string() }).optional(),
  markdown: z.object({ content: z.string() }).optional(),
})), async (c) => {
  const data = c.req.valid('json');

  try {
    if (!wechatConfig.webhookUrl) {
      return c.json({ code: 400, message: '请先配置Webhook地址' }, 400);
    }

    // 模拟发送webhook
    await new Promise(resolve => setTimeout(resolve, 200));

    return c.json({
      code: 0,
      message: 'Webhook发送成功',
    });
  } catch (error) {
    return c.json({ code: 500, message: 'Webhook发送失败' }, 500);
  }
});

// 获取JS-SDK配置（用于H5页面）
wechatRoutes.get('/jsconfig', authMiddleware, async (c) => {
  const url = c.req.query('url') || '';

  try {
    // 模拟生成JS-SDK签名
    const timestamp = Math.floor(Date.now() / 1000);
    const nonceStr = crypto.randomUUID().replace(/-/g, '').substring(0, 16);

    return c.json({
      code: 0,
      data: {
        appId: wechatConfig.corpId,
        timestamp,
        nonceStr,
        signature: 'simulated_signature_' + nonceStr,
      },
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取配置失败' }, 500);
  }
});

// 企业微信OAuth认证回调
wechatRoutes.get('/oauth/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');

  try {
    if (!code) {
      return c.json({ code: 400, message: '缺少授权码' }, 400);
    }

    // 模拟获取用户信息
    const userInfo = {
      userId: 'wechat_' + crypto.randomUUID().substring(0, 8),
      name: '企微用户',
      mobile: '138****1234',
      email: 'user@company.com',
      avatar: '',
    };

    return c.json({
      code: 0,
      data: userInfo,
    });
  } catch (error) {
    return c.json({ code: 500, message: '认证失败' }, 500);
  }
});

// 获取通讯录部门
wechatRoutes.get('/departments', authMiddleware, async (c) => {
  try {
    // 模拟部门列表
    const departments = [
      { id: 1, name: '全公司', parentId: 0 },
      { id: 2, name: '运维部', parentId: 1 },
      { id: 3, name: '网络组', parentId: 2 },
      { id: 4, name: '系统组', parentId: 2 },
      { id: 5, name: '研发部', parentId: 1 },
    ];

    return c.json({
      code: 0,
      data: departments,
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取部门失败' }, 500);
  }
});

// 获取部门成员
wechatRoutes.get('/users', authMiddleware, async (c) => {
  const departmentId = c.req.query('departmentId') || '1';

  try {
    // 模拟用户列表
    const users = [
      { userId: 'user1', name: '张三', department: [2, 3], mobile: '138****0001' },
      { userId: 'user2', name: '李四', department: [2, 4], mobile: '138****0002' },
      { userId: 'user3', name: '王五', department: [5], mobile: '138****0003' },
    ];

    return c.json({
      code: 0,
      data: users,
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取成员失败' }, 500);
  }
});

export { wechatRoutes };
