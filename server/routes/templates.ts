import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const templateRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 通知模板存储（实际应使用数据库）
const notificationTemplates = new Map<string, {
  id: string;
  name: string;
  type: 'alert' | 'report' | 'system';
  channel: 'email' | 'webhook' | 'sms' | 'dingtalk' | 'wechat';
  subject?: string;
  content: string;
  variables: string[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}>();

// 默认模板
const defaultTemplates = [
  {
    id: '1',
    name: '设备离线告警',
    type: 'alert' as const,
    channel: 'email' as const,
    subject: '[告警] 设备 {{deviceName}} 离线',
    content: `【NetVis Pro 告警通知】

设备名称: {{deviceName}}
设备IP: {{deviceIp}}
告警类型: 设备离线
告警时间: {{alertTime}}
告警级别: {{severity}}

请及时处理！

---
此邮件由系统自动发送，请勿直接回复。`,
    variables: ['deviceName', 'deviceIp', 'alertTime', 'severity'],
    isDefault: true,
  },
  {
    id: '2',
    name: '阈值告警',
    type: 'alert' as const,
    channel: 'webhook' as const,
    content: JSON.stringify({
      msgtype: 'markdown',
      markdown: {
        title: '{{alertTitle}}',
        text: '### {{alertTitle}}\n- 设备: {{deviceName}}\n- 指标: {{metricName}}\n- 当前值: {{currentValue}}\n- 阈值: {{threshold}}\n- 时间: {{alertTime}}',
      },
    }, null, 2),
    variables: ['alertTitle', 'deviceName', 'metricName', 'currentValue', 'threshold', 'alertTime'],
    isDefault: true,
  },
  {
    id: '3',
    name: '日报模板',
    type: 'report' as const,
    channel: 'email' as const,
    subject: '[日报] {{date}} 系统运行报告',
    content: `【NetVis Pro 日报】

日期: {{date}}

## 系统概况
- 设备总数: {{totalDevices}}
- 在线率: {{onlineRate}}%
- 告警数量: {{alertCount}}

## 主要指标
- 平均延迟: {{avgLatency}}ms
- CPU峰值: {{maxCpu}}%
- 内存峰值: {{maxMemory}}%

---
此邮件由系统自动发送`,
    variables: ['date', 'totalDevices', 'onlineRate', 'alertCount', 'avgLatency', 'maxCpu', 'maxMemory'],
    isDefault: true,
  },
];

defaultTemplates.forEach(t => {
  notificationTemplates.set(t.id, {
    ...t,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
});

// 模板Schema
const templateSchema = z.object({
  name: z.string().min(1, '模板名称不能为空'),
  type: z.enum(['alert', 'report', 'system']),
  channel: z.enum(['email', 'webhook', 'sms', 'dingtalk', 'wechat']),
  subject: z.string().optional(),
  content: z.string().min(1, '模板内容不能为空'),
  variables: z.array(z.string()).optional(),
});

// 获取模板列表
templateRoutes.get('/list', authMiddleware, async (c) => {
  const type = c.req.query('type');
  const channel = c.req.query('channel');

  try {
    let templates = Array.from(notificationTemplates.values());

    if (type) {
      templates = templates.filter(t => t.type === type);
    }
    if (channel) {
      templates = templates.filter(t => t.channel === channel);
    }

    templates.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return c.json({
      code: 0,
      data: templates,
    });
  } catch (error) {
    console.error('Get templates error:', error);
    return c.json({ code: 500, message: '获取模板列表失败' }, 500);
  }
});

// 获取单个模板
templateRoutes.get('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  
  try {
    const template = notificationTemplates.get(id);
    if (!template) {
      return c.json({ code: 404, message: '模板不存在' }, 404);
    }

    return c.json({ code: 0, data: template });
  } catch (error) {
    return c.json({ code: 500, message: '获取模板失败' }, 500);
  }
});

// 创建模板
templateRoutes.post('/', authMiddleware, requireRole('admin'), zValidator('json', templateSchema), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const id = crypto.randomUUID();
    
    // 解析变量
    const variableRegex = /\{\{(\w+)\}\}/g;
    const variables = [...new Set([...(data.content.matchAll(variableRegex) || [])].map(m => m[1]))];

    const template = {
      id,
      name: data.name,
      type: data.type,
      channel: data.channel,
      subject: data.subject,
      content: data.content,
      variables,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    notificationTemplates.set(id, template);

    // 审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'create',
      resource: 'notification_templates',
      resourceId: id,
      details: JSON.stringify({ name: data.name }),
    });

    return c.json({
      code: 0,
      message: '模板创建成功',
      data: template,
    });
  } catch (error) {
    console.error('Create template error:', error);
    return c.json({ code: 500, message: '创建模板失败' }, 500);
  }
});

// 更新模板
templateRoutes.put('/:id', authMiddleware, requireRole('admin'), zValidator('json', templateSchema.partial()), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  try {
    const template = notificationTemplates.get(id);
    if (!template) {
      return c.json({ code: 404, message: '模板不存在' }, 404);
    }

    if (data.name) template.name = data.name;
    if (data.type) template.type = data.type;
    if (data.channel) template.channel = data.channel;
    if (data.subject !== undefined) template.subject = data.subject;
    if (data.content) {
      template.content = data.content;
      const variableRegex = /\{\{(\w+)\}\}/g;
      template.variables = [...new Set([...(data.content.matchAll(variableRegex) || [])].map(m => m[1]))];
    }
    template.updatedAt = new Date();

    return c.json({ code: 0, message: '模板更新成功' });
  } catch (error) {
    console.error('Update template error:', error);
    return c.json({ code: 500, message: '更新模板失败' }, 500);
  }
});

// 删除模板
templateRoutes.delete('/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const currentUser = c.get('user');

  try {
    const template = notificationTemplates.get(id);
    if (!template) {
      return c.json({ code: 404, message: '模板不存在' }, 404);
    }

    if (template.isDefault) {
      return c.json({ code: 400, message: '默认模板不能删除' }, 400);
    }

    notificationTemplates.delete(id);

    // 审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'delete',
      resource: 'notification_templates',
      resourceId: id,
    });

    return c.json({ code: 0, message: '模板删除成功' });
  } catch (error) {
    console.error('Delete template error:', error);
    return c.json({ code: 500, message: '删除模板失败' }, 500);
  }
});

// 预览模板
templateRoutes.post('/preview', authMiddleware, zValidator('json', z.object({
  content: z.string(),
  variables: z.record(z.string()),
})), async (c) => {
  const { content, variables } = c.req.valid('json');

  try {
    let result = content;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }

    return c.json({
      code: 0,
      data: { preview: result },
    });
  } catch (error) {
    return c.json({ code: 500, message: '预览失败' }, 500);
  }
});

// 测试发送
templateRoutes.post('/:id/test', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');

  try {
    const template = notificationTemplates.get(id);
    if (!template) {
      return c.json({ code: 404, message: '模板不存在' }, 404);
    }

    // 模拟发送
    console.log(`Test sending template: ${template.name}`);

    return c.json({
      code: 0,
      message: '测试发送成功',
    });
  } catch (error) {
    return c.json({ code: 500, message: '测试发送失败' }, 500);
  }
});

export { templateRoutes };
