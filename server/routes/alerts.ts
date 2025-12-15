import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc, count, and } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const alertRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 告警查询参数
const listQuerySchema = z.object({
  page: z.string().optional().transform(v => parseInt(v || '1')),
  pageSize: z.string().optional().transform(v => parseInt(v || '20')),
  status: z.enum(['pending', 'acknowledged', 'resolved', 'all']).optional(),
  severity: z.enum(['info', 'warning', 'critical', 'all']).optional(),
  deviceId: z.string().uuid().optional(),
});

// 告警规则创建
const alertRuleSchema = z.object({
  name: z.string().min(1, '规则名称不能为空'),
  description: z.string().optional(),
  type: z.enum(['threshold', 'status', 'composite']),
  conditions: z.string(), // JSON string
  severity: z.enum(['info', 'warning', 'critical']),
  isEnabled: z.boolean().optional(),
});

// 获取告警列表
alertRoutes.get('/', authMiddleware, zValidator('query', listQuerySchema), async (c) => {
  const { page, pageSize, status, severity, deviceId } = c.req.valid('query');
  const offset = (page - 1) * pageSize;

  try {
    const alerts = await db
      .select()
      .from(schema.alerts)
      .orderBy(desc(schema.alerts.createdAt))
      .limit(pageSize)
      .offset(offset);

    const totalResult = await db.select({ total: count() }).from(schema.alerts);
    const total = totalResult[0]?.total ?? 0;

    return c.json({
      code: 0,
      data: {
        list: alerts,
        total,
        page,
        pageSize,
      },
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    return c.json({ code: 500, message: '获取告警列表失败' }, 500);
  }
});

// 获取告警统计
alertRoutes.get('/stats', authMiddleware, async (c) => {
  try {
    const pendingResult = await db
      .select({ count: count() })
      .from(schema.alerts)
      .where(eq(schema.alerts.status, 'pending'));

    const criticalResult = await db
      .select({ count: count() })
      .from(schema.alerts)
      .where(and(
        eq(schema.alerts.status, 'pending'),
        eq(schema.alerts.severity, 'critical')
      ));

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    return c.json({
      code: 0,
      data: {
        pending: pendingResult[0]?.count ?? 0,
        critical: criticalResult[0]?.count ?? 0,
        totalToday: 0, // 简化处理
      },
    });
  } catch (error) {
    console.error('Get alert stats error:', error);
    return c.json({ code: 500, message: '获取告警统计失败' }, 500);
  }
});

// 获取单个告警
alertRoutes.get('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');

  try {
    const [alert] = await db
      .select()
      .from(schema.alerts)
      .where(eq(schema.alerts.id, id))
      .limit(1);

    if (!alert) {
      return c.json({ code: 404, message: '告警不存在' }, 404);
    }

    return c.json({ code: 0, data: alert });
  } catch (error) {
    console.error('Get alert error:', error);
    return c.json({ code: 500, message: '获取告警详情失败' }, 500);
  }
});

// 确认告警
alertRoutes.put('/:id/ack', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const currentUser = c.get('user');

  try {
    const [existing] = await db
      .select()
      .from(schema.alerts)
      .where(eq(schema.alerts.id, id))
      .limit(1);

    if (!existing) {
      return c.json({ code: 404, message: '告警不存在' }, 404);
    }

    await db
      .update(schema.alerts)
      .set({
        status: 'acknowledged',
        acknowledgedBy: currentUser.userId,
        acknowledgedAt: new Date(),
      })
      .where(eq(schema.alerts.id, id));

    // 记录审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'acknowledge',
      resource: 'alerts',
      resourceId: id,
    });

    return c.json({ code: 0, message: '告警已确认' });
  } catch (error) {
    console.error('Acknowledge alert error:', error);
    return c.json({ code: 500, message: '确认告警失败' }, 500);
  }
});

// 解决告警
alertRoutes.put('/:id/resolve', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const currentUser = c.get('user');

  try {
    const [existing] = await db
      .select()
      .from(schema.alerts)
      .where(eq(schema.alerts.id, id))
      .limit(1);

    if (!existing) {
      return c.json({ code: 404, message: '告警不存在' }, 404);
    }

    await db
      .update(schema.alerts)
      .set({
        status: 'resolved',
        resolvedBy: currentUser.userId,
        resolvedAt: new Date(),
      })
      .where(eq(schema.alerts.id, id));

    // 记录审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'resolve',
      resource: 'alerts',
      resourceId: id,
    });

    return c.json({ code: 0, message: '告警已解决' });
  } catch (error) {
    console.error('Resolve alert error:', error);
    return c.json({ code: 500, message: '解决告警失败' }, 500);
  }
});

// 批量确认告警
alertRoutes.put('/batch/ack', authMiddleware, zValidator('json', z.object({
  ids: z.array(z.string().uuid()),
})), async (c) => {
  const { ids } = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    for (const id of ids) {
      await db
        .update(schema.alerts)
        .set({
          status: 'acknowledged',
          acknowledgedBy: currentUser.userId,
          acknowledgedAt: new Date(),
        })
        .where(eq(schema.alerts.id, id));
    }

    return c.json({ code: 0, message: `已确认 ${ids.length} 个告警` });
  } catch (error) {
    console.error('Batch acknowledge error:', error);
    return c.json({ code: 500, message: '批量确认失败' }, 500);
  }
});

// 批量解决告警
alertRoutes.put('/batch/resolve', authMiddleware, zValidator('json', z.object({
  ids: z.array(z.string().uuid()),
})), async (c) => {
  const { ids } = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    for (const id of ids) {
      await db
        .update(schema.alerts)
        .set({
          status: 'resolved',
          resolvedBy: currentUser.userId,
          resolvedAt: new Date(),
        })
        .where(eq(schema.alerts.id, id));
    }

    return c.json({ code: 0, message: `已解决 ${ids.length} 个告警` });
  } catch (error) {
    console.error('Batch resolve error:', error);
    return c.json({ code: 500, message: '批量解决失败' }, 500);
  }
});

// ========== 告警规则 ==========

// 获取告警规则列表
alertRoutes.get('/rules', authMiddleware, async (c) => {
  try {
    const rules = await db
      .select()
      .from(schema.alertRules)
      .orderBy(desc(schema.alertRules.createdAt));

    return c.json({
      code: 0,
      data: rules,
    });
  } catch (error) {
    console.error('Get alert rules error:', error);
    return c.json({ code: 500, message: '获取告警规则失败' }, 500);
  }
});

// 创建告警规则
alertRoutes.post('/rules', authMiddleware, requireRole('admin'), zValidator('json', alertRuleSchema), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const result = await db
      .insert(schema.alertRules)
      .values({
        name: data.name,
        description: data.description,
        type: data.type,
        conditions: data.conditions,
        severity: data.severity,
        isEnabled: data.isEnabled ?? true,
        createdBy: currentUser.userId,
      })
      .returning();

    const newRule = result[0];
    if (!newRule) {
      return c.json({ code: 500, message: '创建规则失败' }, 500);
    }

    return c.json({
      code: 0,
      message: '规则创建成功',
      data: newRule,
    });
  } catch (error) {
    console.error('Create alert rule error:', error);
    return c.json({ code: 500, message: '创建规则失败' }, 500);
  }
});

// 更新告警规则
alertRoutes.put('/rules/:id', authMiddleware, requireRole('admin'), zValidator('json', alertRuleSchema.partial()), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  try {
    const [existing] = await db
      .select()
      .from(schema.alertRules)
      .where(eq(schema.alertRules.id, id))
      .limit(1);

    if (!existing) {
      return c.json({ code: 404, message: '规则不存在' }, 404);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.conditions !== undefined) updateData.conditions = data.conditions;
    if (data.severity !== undefined) updateData.severity = data.severity;
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;

    await db
      .update(schema.alertRules)
      .set(updateData)
      .where(eq(schema.alertRules.id, id));

    return c.json({ code: 0, message: '规则更新成功' });
  } catch (error) {
    console.error('Update alert rule error:', error);
    return c.json({ code: 500, message: '更新规则失败' }, 500);
  }
});

// 删除告警规则
alertRoutes.delete('/rules/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');

  try {
    await db.delete(schema.alertRules).where(eq(schema.alertRules.id, id));
    return c.json({ code: 0, message: '规则删除成功' });
  } catch (error) {
    console.error('Delete alert rule error:', error);
    return c.json({ code: 500, message: '删除规则失败' }, 500);
  }
});

export { alertRoutes };
