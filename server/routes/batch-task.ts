import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const batchTaskRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 批量任务存储
const batchTasks = new Map<string, {
  id: string;
  name: string;
  type: 'command' | 'config' | 'firmware' | 'restart';
  status: 'pending' | 'running' | 'completed' | 'failed';
  deviceIds: string[];
  progress: { total: number; completed: number; failed: number };
  results: { deviceId: string; status: string; message: string; timestamp: Date }[];
  createdBy: string;
  createdAt: Date;
  completedAt?: Date;
}>();

// 获取批量任务列表
batchTaskRoutes.get('/', authMiddleware, async (c) => {
  const tasks = Array.from(batchTasks.values())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return c.json({ code: 0, data: tasks });
});

// 创建批量任务
batchTaskRoutes.post('/', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  name: z.string().min(1),
  type: z.enum(['command', 'config', 'firmware', 'restart']),
  deviceIds: z.array(z.string()),
  command: z.string().optional(),
  configTemplate: z.string().optional(),
})), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const id = crypto.randomUUID();
    const task = {
      id,
      name: data.name,
      type: data.type,
      status: 'pending' as const,
      deviceIds: data.deviceIds,
      progress: { total: data.deviceIds.length, completed: 0, failed: 0 },
      results: [] as { deviceId: string; status: string; message: string; timestamp: Date }[],
      createdBy: currentUser.userId,
      createdAt: new Date(),
    };
    batchTasks.set(id, task);

    // 模拟异步执行
    setTimeout(() => {
      const t = batchTasks.get(id);
      if (t) {
        t.status = 'running';
        let completed = 0;
        const interval = setInterval(() => {
          if (completed >= t.deviceIds.length) {
            clearInterval(interval);
            t.status = 'completed';
            t.completedAt = new Date();
            return;
          }
          const deviceId = t.deviceIds[completed]!;
          const success = Math.random() > 0.1;
          t.results.push({
            deviceId,
            status: success ? 'success' : 'failed',
            message: success ? '执行成功' : '执行超时',
            timestamp: new Date(),
          });
          t.progress.completed++;
          if (!success) t.progress.failed++;
          completed++;
        }, 500);
      }
    }, 1000);

    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'create_batch_task',
      resource: 'batch',
      details: JSON.stringify({ taskId: id, type: data.type, deviceCount: data.deviceIds.length }),
    });

    return c.json({ code: 0, message: '批量任务已创建', data: { id } });
  } catch (error) {
    return c.json({ code: 500, message: '创建失败' }, 500);
  }
});

// 获取任务详情
batchTaskRoutes.get('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const task = batchTasks.get(id);

  if (!task) return c.json({ code: 404, message: '任务不存在' }, 404);
  return c.json({ code: 0, data: task });
});

// 取消任务
batchTaskRoutes.post('/:id/cancel', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const task = batchTasks.get(id);

  if (!task) return c.json({ code: 404, message: '任务不存在' }, 404);
  if (task.status !== 'pending' && task.status !== 'running') {
    return c.json({ code: 400, message: '任务无法取消' }, 400);
  }

  task.status = 'failed';
  task.completedAt = new Date();

  return c.json({ code: 0, message: '任务已取消' });
});

// 重试失败的设备
batchTaskRoutes.post('/:id/retry', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const task = batchTasks.get(id);

  if (!task) return c.json({ code: 404, message: '任务不存在' }, 404);

  const failedDevices = task.results.filter(r => r.status === 'failed').map(r => r.deviceId);
  if (failedDevices.length === 0) {
    return c.json({ code: 400, message: '没有失败的设备' }, 400);
  }

  // 模拟重试
  failedDevices.forEach(deviceId => {
    const idx = task.results.findIndex(r => r.deviceId === deviceId);
    if (idx >= 0) {
      task.results[idx] = { deviceId, status: 'success', message: '重试成功', timestamp: new Date() };
      task.progress.failed--;
    }
  });

  return c.json({ code: 0, message: `已重试 ${failedDevices.length} 个设备` });
});

// 获取批量任务统计
batchTaskRoutes.get('/stats/summary', authMiddleware, async (c) => {
  const tasks = Array.from(batchTasks.values());
  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    running: tasks.filter(t => t.status === 'running').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length,
    successRate: tasks.length > 0
      ? (tasks.filter(t => t.status === 'completed').length / tasks.length * 100).toFixed(1)
      : '0',
  };

  return c.json({ code: 0, data: stats });
});

export { batchTaskRoutes };
