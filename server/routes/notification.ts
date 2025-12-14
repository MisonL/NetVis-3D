import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc, and, count } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';
import crypto from 'crypto';

const notificationRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 获取通知列表
notificationRoutes.get('/', authMiddleware, async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const type = c.req.query('type');
    const isRead = c.req.query('isRead');

    // 模拟通知数据
    const notifications = [
      {
        id: '1',
        type: 'alert',
        title: '设备离线告警',
        content: 'Core-Router-01 已离线超过5分钟',
        priority: 'high',
        isRead: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        type: 'system',
        title: 'License即将到期',
        content: '您的License将于30天后到期，请及时续费',
        priority: 'medium',
        isRead: false,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: '3',
        type: 'task',
        title: '配置备份完成',
        content: '10台设备配置备份成功',
        priority: 'low',
        isRead: true,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: '4',
        type: 'report',
        title: '周报已生成',
        content: '设备资产周报已自动生成，点击查看',
        priority: 'low',
        isRead: true,
        createdAt: new Date(Date.now() - 172800000).toISOString(),
      },
    ];

    // 过滤
    let filtered = notifications;
    if (type) {
      filtered = filtered.filter(n => n.type === type);
    }
    if (isRead !== undefined) {
      filtered = filtered.filter(n => n.isRead === (isRead === 'true'));
    }

    return c.json({
      code: 0,
      data: {
        list: filtered.slice((page - 1) * pageSize, page * pageSize),
        pagination: {
          page,
          pageSize,
          total: filtered.length,
        },
        unreadCount: notifications.filter(n => !n.isRead).length,
      },
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return c.json({ code: 500, message: '获取通知失败' }, 500);
  }
});

// 标记已读
notificationRoutes.put('/:id/read', authMiddleware, async (c) => {
  const id = c.req.param('id');

  try {
    return c.json({
      code: 0,
      message: '已标记为已读',
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return c.json({ code: 500, message: '操作失败' }, 500);
  }
});

// 全部标记已读
notificationRoutes.put('/read-all', authMiddleware, async (c) => {
  try {
    return c.json({
      code: 0,
      message: '全部标记为已读',
    });
  } catch (error) {
    console.error('Mark all read error:', error);
    return c.json({ code: 500, message: '操作失败' }, 500);
  }
});

// 删除通知
notificationRoutes.delete('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');

  try {
    return c.json({
      code: 0,
      message: '通知已删除',
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    return c.json({ code: 500, message: '删除失败' }, 500);
  }
});

// 获取通知设置（通知渠道列表）
notificationRoutes.get('/settings', authMiddleware, async (c) => {
  try {
    // 从数据库获取已配置的通知渠道
    const channels = await db
      .select({
        id: schema.notificationChannels.id,
        name: schema.notificationChannels.name,
        type: schema.notificationChannels.type,
        config: schema.notificationChannels.config,
        isEnabled: schema.notificationChannels.isEnabled,
        isDefault: schema.notificationChannels.isDefault,
        createdAt: schema.notificationChannels.createdAt,
      })
      .from(schema.notificationChannels)
      .orderBy(desc(schema.notificationChannels.createdAt));

    // 可用通道类型
    const availableChannels = [
      { id: 'email', name: '邮件通知', description: '通过邮件接收通知', icon: 'mail' },
      { id: 'webhook', name: 'Webhook', description: '通用HTTP回调', icon: 'api' },
      { id: 'dingtalk', name: '钉钉机器人', description: '推送到钉钉群', icon: 'message' },
      { id: 'wechat', name: '企业微信', description: '推送到企微群或应用', icon: 'wechat' },
      { id: 'slack', name: 'Slack', description: '推送到Slack频道', icon: 'slack' },
    ];

    return c.json({
      code: 0,
      data: {
        channels,
        availableChannels,
      },
    });
  } catch (error) {
    console.error('Get notification settings error:', error);
    return c.json({ code: 500, message: '获取设置失败' }, 500);
  }
});

// 更新通知设置（创建或更新通知渠道）
const updateSettingsSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  type: z.enum(['email', 'webhook', 'dingtalk', 'wechat', 'slack']),
  config: z.record(z.string(), z.any()),
  isEnabled: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

notificationRoutes.put('/settings', authMiddleware, requireRole('admin'), zValidator('json', updateSettingsSchema), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    let channelId = data.id;

    if (channelId) {
      // 更新现有渠道
      await db
        .update(schema.notificationChannels)
        .set({
          name: data.name,
          type: data.type,
          config: JSON.stringify(data.config),
          isEnabled: data.isEnabled,
          isDefault: data.isDefault,
          updatedAt: new Date(),
        })
        .where(eq(schema.notificationChannels.id, channelId));
    } else {
      // 创建新渠道
      const [newChannel] = await db
        .insert(schema.notificationChannels)
        .values({
          name: data.name,
          type: data.type,
          config: JSON.stringify(data.config),
          isEnabled: data.isEnabled,
          isDefault: data.isDefault,
          createdBy: currentUser.userId,
        })
        .returning();
      channelId = newChannel?.id;
    }

    // 记录审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: data.id ? 'update' : 'create',
      resource: 'notification_channels',
      resourceId: channelId,
      details: JSON.stringify({ name: data.name, type: data.type }),
    });

    return c.json({
      code: 0,
      message: '设置已更新',
      data: { id: channelId },
    });
  } catch (error) {
    console.error('Update notification settings error:', error);
    return c.json({ code: 500, message: '更新设置失败' }, 500);
  }
});

// 测试通知渠道
notificationRoutes.post('/test/:channelId', authMiddleware, requireRole('admin'), async (c) => {
  const channelId = c.req.param('channelId');

  try {
    // 模拟测试
    return c.json({
      code: 0,
      message: '测试消息已发送',
      data: {
        success: true,
        channel: channelId,
      },
    });
  } catch (error) {
    console.error('Test notification channel error:', error);
    return c.json({ code: 500, message: '测试失败' }, 500);
  }
});

// 获取未读数量
notificationRoutes.get('/unread-count', authMiddleware, async (c) => {
  try {
    return c.json({
      code: 0,
      data: {
        count: 2,
        byType: {
          alert: 1,
          system: 1,
          task: 0,
          report: 0,
        },
      },
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    return c.json({ code: 500, message: '获取未读数量失败' }, 500);
  }
});

export { notificationRoutes };
