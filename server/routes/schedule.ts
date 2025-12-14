import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const scheduleRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 内存中的定时任务（实际应使用Redis或数据库）
const scheduledJobs = new Map<string, {
  id: string;
  name: string;
  type: 'backup' | 'report' | 'cleanup' | 'discovery' | 'health_check';
  cron: string;
  isEnabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  status: 'idle' | 'running' | 'success' | 'failed';
  createdAt: Date;
}>();

// 初始化默认任务
const initDefaultJobs = () => {
  const defaultJobs = [
    { id: '1', name: '每日设备状态检查', type: 'health_check' as const, cron: '0 6 * * *', isEnabled: true },
    { id: '2', name: '配置自动备份', type: 'backup' as const, cron: '0 2 * * *', isEnabled: true },
    { id: '3', name: '每周报表生成', type: 'report' as const, cron: '0 8 * * 1', isEnabled: true },
    { id: '4', name: '日志清理', type: 'cleanup' as const, cron: '0 3 * * 0', isEnabled: false },
  ];
  
  defaultJobs.forEach(job => {
    if (!scheduledJobs.has(job.id)) {
      scheduledJobs.set(job.id, {
        ...job,
        status: 'idle',
        createdAt: new Date(),
        nextRun: getNextRun(job.cron),
      });
    }
  });
};

// 简单计算下次执行时间
const getNextRun = (cron: string): Date => {
  const now = new Date();
  now.setHours(now.getHours() + 24); // 简化：下次在24小时后
  return now;
};

initDefaultJobs();

// 定时任务创建/更新Schema
const jobSchema = z.object({
  name: z.string().min(1, '任务名称不能为空'),
  type: z.enum(['backup', 'report', 'cleanup', 'discovery', 'health_check']),
  cron: z.string().regex(/^[\d\s\*\/\-,]+$/, 'Cron表达式格式不正确'),
  isEnabled: z.boolean().optional(),
});

// 获取定时任务列表
scheduleRoutes.get('/jobs', authMiddleware, requireRole('admin'), async (c) => {
  try {
    const jobs = Array.from(scheduledJobs.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return c.json({
      code: 0,
      data: jobs,
    });
  } catch (error) {
    console.error('Get scheduled jobs error:', error);
    return c.json({ code: 500, message: '获取定时任务失败' }, 500);
  }
});

// 创建定时任务
scheduleRoutes.post('/jobs', authMiddleware, requireRole('admin'), zValidator('json', jobSchema), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const id = crypto.randomUUID();
    
    const job = {
      id,
      name: data.name,
      type: data.type,
      cron: data.cron,
      isEnabled: data.isEnabled ?? true,
      status: 'idle' as const,
      createdAt: new Date(),
      nextRun: getNextRun(data.cron),
    };
    
    scheduledJobs.set(id, job);

    // 记录审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'create',
      resource: 'scheduled_jobs',
      resourceId: id,
      details: JSON.stringify({ name: data.name, type: data.type }),
    });

    return c.json({
      code: 0,
      message: '定时任务创建成功',
      data: job,
    });
  } catch (error) {
    console.error('Create scheduled job error:', error);
    return c.json({ code: 500, message: '创建定时任务失败' }, 500);
  }
});

// 更新定时任务
scheduleRoutes.put('/jobs/:id', authMiddleware, requireRole('admin'), zValidator('json', jobSchema.partial()), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  try {
    const job = scheduledJobs.get(id);
    if (!job) {
      return c.json({ code: 404, message: '任务不存在' }, 404);
    }

    if (data.name !== undefined) job.name = data.name;
    if (data.type !== undefined) job.type = data.type;
    if (data.cron !== undefined) {
      job.cron = data.cron;
      job.nextRun = getNextRun(data.cron);
    }
    if (data.isEnabled !== undefined) job.isEnabled = data.isEnabled;

    return c.json({ code: 0, message: '定时任务更新成功' });
  } catch (error) {
    console.error('Update scheduled job error:', error);
    return c.json({ code: 500, message: '更新定时任务失败' }, 500);
  }
});

// 删除定时任务
scheduleRoutes.delete('/jobs/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');

  try {
    if (!scheduledJobs.has(id)) {
      return c.json({ code: 404, message: '任务不存在' }, 404);
    }

    scheduledJobs.delete(id);
    return c.json({ code: 0, message: '定时任务删除成功' });
  } catch (error) {
    console.error('Delete scheduled job error:', error);
    return c.json({ code: 500, message: '删除定时任务失败' }, 500);
  }
});

// 立即执行定时任务
scheduleRoutes.post('/jobs/:id/run', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const currentUser = c.get('user');

  try {
    const job = scheduledJobs.get(id);
    if (!job) {
      return c.json({ code: 404, message: '任务不存在' }, 404);
    }

    // 模拟执行
    job.status = 'running';
    
    setTimeout(() => {
      job.status = 'success';
      job.lastRun = new Date();
      job.nextRun = getNextRun(job.cron);
    }, 2000);

    // 记录审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'execute',
      resource: 'scheduled_jobs',
      resourceId: id,
      details: JSON.stringify({ name: job.name }),
    });

    return c.json({
      code: 0,
      message: '任务已开始执行',
    });
  } catch (error) {
    console.error('Run scheduled job error:', error);
    return c.json({ code: 500, message: '执行任务失败' }, 500);
  }
});

// 获取任务执行历史
scheduleRoutes.get('/jobs/:id/history', authMiddleware, async (c) => {
  const id = c.req.param('id');

  try {
    const job = scheduledJobs.get(id);
    if (!job) {
      return c.json({ code: 404, message: '任务不存在' }, 404);
    }

    // 模拟执行历史
    const history = [
      { id: '1', runAt: new Date(Date.now() - 86400000), duration: 45, status: 'success', result: '成功' },
      { id: '2', runAt: new Date(Date.now() - 172800000), duration: 52, status: 'success', result: '成功' },
      { id: '3', runAt: new Date(Date.now() - 259200000), duration: 38, status: 'failed', result: '连接超时' },
    ];

    return c.json({
      code: 0,
      data: history,
    });
  } catch (error) {
    console.error('Get job history error:', error);
    return c.json({ code: 500, message: '获取执行历史失败' }, 500);
  }
});

export { scheduleRoutes };
