import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const firmwareRoutes = new Hono<{ Variables: { user: JwtPayload } }>();

// 固件库存储
const firmwareLibrary = new Map<string, {
  id: string;
  vendor: string;
  model: string;
  version: string;
  fileName: string;
  fileSize: number;
  checksum: string;
  releaseDate: Date;
  changelog: string;
  uploadedAt: Date;
}>();

// 升级任务
const upgradeTasks = new Map<string, {
  id: string;
  firmwareId: string;
  deviceIds: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: { total: number; completed: number; failed: number };
  results: { deviceId: string; status: string; message: string }[];
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdBy: string;
  createdAt: Date;
}>();

// 初始化示例数据
[
  { id: 'fw-1', vendor: 'Cisco', model: 'Catalyst 9300', version: '17.3.4', fileName: 'cat9k_iosxe.17.03.04.SPA.bin', fileSize: 524288000, checksum: 'abc123', releaseDate: new Date('2024-01-15'), changelog: '安全补丁更新' },
  { id: 'fw-2', vendor: 'Huawei', model: 'S5720', version: 'V200R019C10', fileName: 's5720-v200r019c10.cc', fileSize: 268435456, checksum: 'def456', releaseDate: new Date('2024-02-20'), changelog: '新增功能特性' },
  { id: 'fw-3', vendor: 'H3C', model: 'S6520', version: 'R6728P05', fileName: 's6520-R6728P05.ipe', fileSize: 314572800, checksum: 'ghi789', releaseDate: new Date('2024-03-10'), changelog: '性能优化' },
].forEach(fw => firmwareLibrary.set(fw.id, { ...fw, uploadedAt: new Date() }));

// 获取固件列表
firmwareRoutes.get('/library', authMiddleware, async (c) => {
  const vendor = c.req.query('vendor');
  let list = Array.from(firmwareLibrary.values());
  if (vendor) list = list.filter(f => f.vendor === vendor);
  return c.json({ code: 0, data: list });
});

// 上传固件(模拟)
firmwareRoutes.post('/library', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  vendor: z.string(),
  model: z.string(),
  version: z.string(),
  fileName: z.string(),
  fileSize: z.number(),
  checksum: z.string(),
  changelog: z.string().optional(),
})), async (c) => {
  const data = c.req.valid('json');
  const id = crypto.randomUUID();
  firmwareLibrary.set(id, { id, ...data, releaseDate: new Date(), changelog: data.changelog || '', uploadedAt: new Date() });
  return c.json({ code: 0, message: '固件已上传', data: { id } });
});

// 删除固件
firmwareRoutes.delete('/library/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  if (!firmwareLibrary.has(id)) return c.json({ code: 404, message: '固件不存在' }, 404);
  firmwareLibrary.delete(id);
  return c.json({ code: 0, message: '固件已删除' });
});

// 创建升级任务
firmwareRoutes.post('/upgrade', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  firmwareId: z.string(),
  deviceIds: z.array(z.string()),
  scheduledAt: z.string().optional(),
})), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');
  const id = crypto.randomUUID();
  
  upgradeTasks.set(id, {
    id,
    firmwareId: data.firmwareId,
    deviceIds: data.deviceIds,
    status: 'pending',
    progress: { total: data.deviceIds.length, completed: 0, failed: 0 },
    results: [],
    scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
    createdBy: currentUser.userId,
    createdAt: new Date(),
  });

  // 模拟异步升级
  setTimeout(() => {
    const task = upgradeTasks.get(id);
    if (task) {
      task.status = 'running';
      task.startedAt = new Date();
      let completed = 0;
      const interval = setInterval(() => {
        if (completed >= task.deviceIds.length) {
          clearInterval(interval);
          task.status = task.progress.failed > 0 ? 'failed' : 'completed';
          task.completedAt = new Date();
          return;
        }
        const deviceId = task.deviceIds[completed]!;
        const success = Math.random() > 0.1;
        task.results.push({ deviceId, status: success ? 'success' : 'failed', message: success ? '升级成功' : '升级超时' });
        task.progress.completed++;
        if (!success) task.progress.failed++;
        completed++;
      }, 1000);
    }
  }, 2000);

  return c.json({ code: 0, message: '升级任务已创建', data: { id } });
});

// 获取升级任务列表
firmwareRoutes.get('/tasks', authMiddleware, async (c) => {
  return c.json({ code: 0, data: Array.from(upgradeTasks.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) });
});

// 获取任务详情
firmwareRoutes.get('/tasks/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const task = upgradeTasks.get(id);
  if (!task) return c.json({ code: 404, message: '任务不存在' }, 404);
  return c.json({ code: 0, data: task });
});

// 取消任务
firmwareRoutes.post('/tasks/:id/cancel', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const task = upgradeTasks.get(id);
  if (!task) return c.json({ code: 404, message: '任务不存在' }, 404);
  if (task.status !== 'pending') return c.json({ code: 400, message: '只能取消待执行的任务' }, 400);
  task.status = 'failed';
  return c.json({ code: 0, message: '任务已取消' });
});

// 固件统计
firmwareRoutes.get('/stats', authMiddleware, async (c) => {
  const tasks = Array.from(upgradeTasks.values());
  return c.json({
    code: 0,
    data: {
      totalFirmware: firmwareLibrary.size,
      totalTasks: tasks.length,
      pendingTasks: tasks.filter(t => t.status === 'pending').length,
      runningTasks: tasks.filter(t => t.status === 'running').length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      failedTasks: tasks.filter(t => t.status === 'failed').length,
    },
  });
});

export { firmwareRoutes };
