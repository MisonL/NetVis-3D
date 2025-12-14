import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const maintenanceRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 维护计划存储
const maintenancePlans = new Map<string, {
  id: string;
  title: string;
  description?: string;
  type: 'scheduled' | 'emergency' | 'upgrade' | 'inspection';
  deviceIds: string[];
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assignee?: string;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}>();

// 初始化示例数据
const initData = () => {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  const nextWeek = new Date(now.getTime() + 7 * 86400000);

  maintenancePlans.set('1', {
    id: '1',
    title: '核心交换机固件升级',
    description: '升级核心交换机到最新固件版本',
    type: 'upgrade',
    deviceIds: [],
    startTime: tomorrow,
    endTime: new Date(tomorrow.getTime() + 7200000),
    status: 'pending',
    assignee: '张工',
    createdBy: 'admin',
    createdAt: now,
    updatedAt: now,
  });

  maintenancePlans.set('2', {
    id: '2',
    title: '月度设备巡检',
    description: '对所有网络设备进行例行巡检',
    type: 'inspection',
    deviceIds: [],
    startTime: nextWeek,
    endTime: new Date(nextWeek.getTime() + 28800000),
    status: 'pending',
    assignee: '李工',
    createdBy: 'admin',
    createdAt: now,
    updatedAt: now,
  });
};

initData();

// 维护计划Schema
const maintenanceSchema = z.object({
  title: z.string().min(1, '标题不能为空'),
  description: z.string().optional(),
  type: z.enum(['scheduled', 'emergency', 'upgrade', 'inspection']),
  deviceIds: z.array(z.string()).optional(),
  startTime: z.string().transform(s => new Date(s)),
  endTime: z.string().transform(s => new Date(s)),
  assignee: z.string().optional(),
  notes: z.string().optional(),
});

// 获取维护计划列表
maintenanceRoutes.get('/list', authMiddleware, async (c) => {
  const status = c.req.query('status');
  const type = c.req.query('type');

  try {
    let plans = Array.from(maintenancePlans.values());

    if (status) {
      plans = plans.filter(p => p.status === status);
    }
    if (type) {
      plans = plans.filter(p => p.type === type);
    }

    plans.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    // 自动更新状态
    const now = Date.now();
    plans.forEach(p => {
      if (p.status === 'pending' && p.startTime.getTime() <= now) {
        p.status = 'in_progress';
      }
      if (p.status === 'in_progress' && p.endTime.getTime() <= now) {
        p.status = 'completed';
      }
    });

    return c.json({
      code: 0,
      data: plans,
    });
  } catch (error) {
    console.error('Get maintenance plans error:', error);
    return c.json({ code: 500, message: '获取维护计划失败' }, 500);
  }
});

// 获取单个维护计划
maintenanceRoutes.get('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');

  try {
    const plan = maintenancePlans.get(id);
    if (!plan) {
      return c.json({ code: 404, message: '维护计划不存在' }, 404);
    }

    return c.json({ code: 0, data: plan });
  } catch (error) {
    return c.json({ code: 500, message: '获取维护计划失败' }, 500);
  }
});

// 创建维护计划
maintenanceRoutes.post('/', authMiddleware, requireRole('admin'), zValidator('json', maintenanceSchema), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const id = crypto.randomUUID();

    const plan = {
      id,
      title: data.title,
      description: data.description,
      type: data.type,
      deviceIds: data.deviceIds || [],
      startTime: data.startTime,
      endTime: data.endTime,
      status: 'pending' as const,
      assignee: data.assignee,
      notes: data.notes,
      createdBy: currentUser.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    maintenancePlans.set(id, plan);

    // 审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'create',
      resource: 'maintenance_plans',
      resourceId: id,
      details: JSON.stringify({ title: data.title }),
    });

    return c.json({
      code: 0,
      message: '维护计划创建成功',
      data: plan,
    });
  } catch (error) {
    console.error('Create maintenance plan error:', error);
    return c.json({ code: 500, message: '创建维护计划失败' }, 500);
  }
});

// 更新维护计划
maintenanceRoutes.put('/:id', authMiddleware, requireRole('admin'), zValidator('json', maintenanceSchema.partial()), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  try {
    const plan = maintenancePlans.get(id);
    if (!plan) {
      return c.json({ code: 404, message: '维护计划不存在' }, 404);
    }

    if (data.title) plan.title = data.title;
    if (data.description !== undefined) plan.description = data.description;
    if (data.type) plan.type = data.type;
    if (data.deviceIds) plan.deviceIds = data.deviceIds;
    if (data.startTime) plan.startTime = data.startTime;
    if (data.endTime) plan.endTime = data.endTime;
    if (data.assignee !== undefined) plan.assignee = data.assignee;
    if (data.notes !== undefined) plan.notes = data.notes;
    plan.updatedAt = new Date();

    return c.json({ code: 0, message: '维护计划更新成功' });
  } catch (error) {
    console.error('Update maintenance plan error:', error);
    return c.json({ code: 500, message: '更新维护计划失败' }, 500);
  }
});

// 更新维护计划状态
maintenanceRoutes.patch('/:id/status', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
})), async (c) => {
  const id = c.req.param('id');
  const { status } = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const plan = maintenancePlans.get(id);
    if (!plan) {
      return c.json({ code: 404, message: '维护计划不存在' }, 404);
    }

    plan.status = status;
    plan.updatedAt = new Date();

    // 审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'update',
      resource: 'maintenance_plans',
      resourceId: id,
      details: JSON.stringify({ status }),
    });

    return c.json({ code: 0, message: '状态更新成功' });
  } catch (error) {
    return c.json({ code: 500, message: '状态更新失败' }, 500);
  }
});

// 删除维护计划
maintenanceRoutes.delete('/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const currentUser = c.get('user');

  try {
    const plan = maintenancePlans.get(id);
    if (!plan) {
      return c.json({ code: 404, message: '维护计划不存在' }, 404);
    }

    maintenancePlans.delete(id);

    // 审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'delete',
      resource: 'maintenance_plans',
      resourceId: id,
    });

    return c.json({ code: 0, message: '维护计划删除成功' });
  } catch (error) {
    console.error('Delete maintenance plan error:', error);
    return c.json({ code: 500, message: '删除维护计划失败' }, 500);
  }
});

// 获取日历视图数据
maintenanceRoutes.get('/calendar/events', authMiddleware, async (c) => {
  const month = c.req.query('month'); // YYYY-MM

  try {
    const plans = Array.from(maintenancePlans.values());

    const events = plans.map(p => ({
      id: p.id,
      title: p.title,
      start: p.startTime.toISOString(),
      end: p.endTime.toISOString(),
      type: p.type,
      status: p.status,
      color: p.status === 'completed' ? '#52c41a' : 
             p.status === 'in_progress' ? '#1890ff' : 
             p.status === 'cancelled' ? '#999' : '#faad14',
    }));

    return c.json({
      code: 0,
      data: events,
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取日历数据失败' }, 500);
  }
});

// 获取统计
maintenanceRoutes.get('/stats/overview', authMiddleware, async (c) => {
  try {
    const plans = Array.from(maintenancePlans.values());

    const byStatus = {
      pending: plans.filter(p => p.status === 'pending').length,
      in_progress: plans.filter(p => p.status === 'in_progress').length,
      completed: plans.filter(p => p.status === 'completed').length,
      cancelled: plans.filter(p => p.status === 'cancelled').length,
    };

    const byType = {
      scheduled: plans.filter(p => p.type === 'scheduled').length,
      emergency: plans.filter(p => p.type === 'emergency').length,
      upgrade: plans.filter(p => p.type === 'upgrade').length,
      inspection: plans.filter(p => p.type === 'inspection').length,
    };

    // 即将到来的维护
    const now = Date.now();
    const upcoming = plans
      .filter(p => p.status === 'pending' && p.startTime.getTime() > now)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      .slice(0, 5);

    return c.json({
      code: 0,
      data: {
        total: plans.length,
        byStatus,
        byType,
        upcoming,
      },
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取统计失败' }, 500);
  }
});

export { maintenanceRoutes };
