import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const alertChannelRoutes = new Hono<{ Variables: { user: JwtPayload } }>();

// 告警渠道
const channels = new Map<string, {
  id: string;
  name: string;
  type: 'email' | 'webhook' | 'sms' | 'dingtalk' | 'wechat';
  config: Record<string, string>;
  enabled: boolean;
  testResult?: { success: boolean; message: string; testedAt: Date };
  createdAt: Date;
}>();

// 初始化示例数据
[
  { id: 'ch-1', name: '运维邮件组', type: 'email' as const, config: { recipients: 'ops@example.com', smtpHost: 'smtp.example.com' } as Record<string, string>, enabled: true },
  { id: 'ch-2', name: '钉钉机器人', type: 'dingtalk' as const, config: { webhook: 'https://oapi.dingtalk.com/robot/send?access_token=xxx' } as Record<string, string>, enabled: true },
  { id: 'ch-3', name: '企业微信', type: 'wechat' as const, config: { key: 'xxx-xxx-xxx' } as Record<string, string>, enabled: false },
].forEach(ch => channels.set(ch.id, { ...ch, createdAt: new Date() }));

// 获取渠道列表
alertChannelRoutes.get('/', authMiddleware, async (c) => {
  return c.json({ code: 0, data: Array.from(channels.values()) });
});

// 获取渠道详情
alertChannelRoutes.get('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const channel = channels.get(id);
  if (!channel) return c.json({ code: 404, message: '渠道不存在' }, 404);
  return c.json({ code: 0, data: channel });
});

// 创建渠道
alertChannelRoutes.post('/', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  name: z.string(),
  type: z.enum(['email', 'webhook', 'sms', 'dingtalk', 'wechat']),
  config: z.record(z.string(), z.string()),
})), async (c) => {
  const data = c.req.valid('json');
  const id = crypto.randomUUID();
  channels.set(id, { id, ...data, enabled: true, createdAt: new Date() });
  return c.json({ code: 0, message: '渠道已创建', data: { id } });
});

// 更新渠道
alertChannelRoutes.put('/:id', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  name: z.string().optional(),
  config: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().optional(),
})), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');
  const channel = channels.get(id);
  if (!channel) return c.json({ code: 404, message: '渠道不存在' }, 404);
  Object.assign(channel, data);
  return c.json({ code: 0, message: '渠道已更新' });
});

// 删除渠道
alertChannelRoutes.delete('/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  if (!channels.has(id)) return c.json({ code: 404, message: '渠道不存在' }, 404);
  channels.delete(id);
  return c.json({ code: 0, message: '渠道已删除' });
});

// 测试渠道
alertChannelRoutes.post('/:id/test', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const channel = channels.get(id);
  if (!channel) return c.json({ code: 404, message: '渠道不存在' }, 404);
  
  // 模拟测试结果
  const success = Math.random() > 0.2;
  channel.testResult = { success, message: success ? '发送成功' : '连接失败', testedAt: new Date() };
  
  return c.json({ code: 0, data: channel.testResult });
});

// 启用/禁用渠道
alertChannelRoutes.post('/:id/toggle', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const channel = channels.get(id);
  if (!channel) return c.json({ code: 404, message: '渠道不存在' }, 404);
  channel.enabled = !channel.enabled;
  return c.json({ code: 0, message: channel.enabled ? '已启用' : '已禁用' });
});

// 渠道统计
alertChannelRoutes.get('/stats/overview', authMiddleware, async (c) => {
  const allChannels = Array.from(channels.values());
  return c.json({
    code: 0,
    data: {
      total: allChannels.length,
      enabled: allChannels.filter(c => c.enabled).length,
      byType: {
        email: allChannels.filter(c => c.type === 'email').length,
        webhook: allChannels.filter(c => c.type === 'webhook').length,
        sms: allChannels.filter(c => c.type === 'sms').length,
        dingtalk: allChannels.filter(c => c.type === 'dingtalk').length,
        wechat: allChannels.filter(c => c.type === 'wechat').length,
      },
    },
  });
});

export { alertChannelRoutes };
