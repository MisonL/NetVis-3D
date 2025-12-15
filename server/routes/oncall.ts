import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const oncallRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 值班计划存储
const oncallSchedules = new Map<string, {
  id: string;
  name: string;
  users: string[];
  rotationType: 'daily' | 'weekly' | 'custom';
  startDate: Date;
  endDate?: Date;
  createdAt: Date;
}>();

// 值班记录
const oncallRecords = new Map<string, {
  id: string;
  scheduleId: string;
  userId: string;
  userName: string;
  startTime: Date;
  endTime: Date;
  status: 'active' | 'completed' | 'cancelled';
}>();

// 告警升级规则
const escalationRules = new Map<string, {
  id: string;
  name: string;
  enabled: boolean;
  conditions: { severity: string; timeout: number }[];
  actions: { type: string; target: string; delay: number }[];
  createdAt: Date;
}>();

// 初始化示例数据
const sampleSchedule = {
  id: 'default',
  name: '网络运维值班',
  users: ['admin', 'operator1', 'operator2'],
  rotationType: 'weekly' as const,
  startDate: new Date(),
  createdAt: new Date(),
};
oncallSchedules.set('default', sampleSchedule);

const sampleRule = {
  id: 'rule-1',
  name: '高危告警升级',
  enabled: true,
  conditions: [
    { severity: 'critical', timeout: 5 },
    { severity: 'warning', timeout: 15 },
  ],
  actions: [
    { type: 'notify', target: 'oncall', delay: 0 },
    { type: 'notify', target: 'manager', delay: 10 },
    { type: 'call', target: 'director', delay: 30 },
  ],
  createdAt: new Date(),
};
escalationRules.set('rule-1', sampleRule);

// 获取当前值班人员
oncallRoutes.get('/current', authMiddleware, async (c) => {
  const now = new Date();
  
  // 模拟当前值班人员
  const users = await db.select().from(schema.users).limit(3);
  const currentOncall = users[0] || { id: '1', username: 'admin', email: 'admin@example.com' };

  return c.json({
    code: 0,
    data: {
      userId: currentOncall.id,
      userName: currentOncall.username,
      email: currentOncall.email,
      startTime: new Date(now.getTime() - 8 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 16 * 60 * 60 * 1000),
      nextOncall: users[1] ? { userId: users[1].id, userName: users[1].username } : null,
    },
  });
});

// 获取值班计划列表
oncallRoutes.get('/schedules', authMiddleware, async (c) => {
  const schedules = Array.from(oncallSchedules.values());
  return c.json({ code: 0, data: schedules });
});

// 创建值班计划
oncallRoutes.post('/schedules', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  name: z.string().min(1),
  users: z.array(z.string()),
  rotationType: z.enum(['daily', 'weekly', 'custom']),
  startDate: z.string(),
  endDate: z.string().optional(),
})), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const id = crypto.randomUUID();
    oncallSchedules.set(id, {
      id,
      name: data.name,
      users: data.users,
      rotationType: data.rotationType,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      createdAt: new Date(),
    });

    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'create_oncall_schedule',
      resource: 'oncall',
      details: JSON.stringify({ scheduleId: id, name: data.name }),
    });

    return c.json({ code: 0, message: '值班计划创建成功', data: { id } });
  } catch (error) {
    return c.json({ code: 500, message: '创建失败' }, 500);
  }
});

// 获取本周值班表
oncallRoutes.get('/weekly', authMiddleware, async (c) => {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const users = await db.select().from(schema.users).limit(7);
  
  const weeklySchedule = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    const user = users[i % users.length] || { id: '1', username: 'admin' };
    weeklySchedule.push({
      date: date.toISOString().split('T')[0],
      dayName: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()],
      userId: user.id,
      userName: user.username,
      isToday: date.toDateString() === now.toDateString(),
    });
  }

  return c.json({ code: 0, data: weeklySchedule });
});

// 获取告警升级规则
oncallRoutes.get('/escalation', authMiddleware, async (c) => {
  const rules = Array.from(escalationRules.values());
  return c.json({ code: 0, data: rules });
});

// 创建告警升级规则
oncallRoutes.post('/escalation', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  name: z.string().min(1),
  conditions: z.array(z.object({
    severity: z.string(),
    timeout: z.number(),
  })),
  actions: z.array(z.object({
    type: z.string(),
    target: z.string(),
    delay: z.number(),
  })),
})), async (c) => {
  const data = c.req.valid('json');

  try {
    const id = crypto.randomUUID();
    escalationRules.set(id, {
      id,
      name: data.name,
      enabled: true,
      conditions: data.conditions,
      actions: data.actions,
      createdAt: new Date(),
    });

    return c.json({ code: 0, message: '升级规则创建成功', data: { id } });
  } catch (error) {
    return c.json({ code: 500, message: '创建失败' }, 500);
  }
});

// 切换升级规则状态
oncallRoutes.put('/escalation/:id/toggle', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');

  try {
    const rule = escalationRules.get(id);
    if (!rule) {
      return c.json({ code: 404, message: '规则不存在' }, 404);
    }

    rule.enabled = !rule.enabled;
    return c.json({ code: 0, message: `规则已${rule.enabled ? '启用' : '禁用'}` });
  } catch (error) {
    return c.json({ code: 500, message: '操作失败' }, 500);
  }
});

// 值班交接
oncallRoutes.post('/handover', authMiddleware, zValidator('json', z.object({
  notes: z.string().optional(),
})), async (c) => {
  const { notes } = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'oncall_handover',
      resource: 'oncall',
      details: JSON.stringify({ notes: notes || '无备注' }),
    });

    return c.json({ code: 0, message: '值班交接已记录' });
  } catch (error) {
    return c.json({ code: 500, message: '交接失败' }, 500);
  }
});

// 值班统计
oncallRoutes.get('/stats', authMiddleware, async (c) => {
  const stats = {
    totalSchedules: oncallSchedules.size,
    activeRules: Array.from(escalationRules.values()).filter(r => r.enabled).length,
    totalRules: escalationRules.size,
    thisWeekAlerts: Math.floor(Math.random() * 50) + 10,
    avgResponseTime: '5.2分钟',
  };

  return c.json({ code: 0, data: stats });
});

export { oncallRoutes };
