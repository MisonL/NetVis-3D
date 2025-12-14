import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc, and, gte, count } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const exportRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 导出任务存储
const exportTasks = new Map<string, {
  id: string;
  type: string;
  format: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  fileUrl?: string;
  fileName?: string;
  createdAt: Date;
  completedAt?: Date;
  createdBy: string;
}>();

// 导出设备列表
exportRoutes.post('/devices', authMiddleware, zValidator('json', z.object({
  format: z.enum(['csv', 'excel', 'json']).default('excel'),
  columns: z.array(z.string()).optional(),
  filters: z.record(z.any()).optional(),
})), async (c) => {
  const { format, columns, filters } = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const devices = await db.select().from(schema.devices);

    const taskId = crypto.randomUUID();
    exportTasks.set(taskId, {
      id: taskId,
      type: 'devices',
      format,
      status: 'processing',
      progress: 0,
      createdAt: new Date(),
      createdBy: currentUser.userId,
    });

    // 模拟导出处理
    setTimeout(() => {
      const task = exportTasks.get(taskId);
      if (task) {
        task.status = 'completed';
        task.progress = 100;
        task.completedAt = new Date();
        task.fileName = `devices_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : format}`;
        task.fileUrl = `/api/export/download/${taskId}`;
      }
    }, 2000);

    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'export_devices',
      resource: 'export',
      details: JSON.stringify({ taskId, format, count: devices.length }),
    });

    return c.json({
      code: 0,
      message: '导出任务已创建',
      data: { taskId },
    });
  } catch (error) {
    return c.json({ code: 500, message: '创建导出任务失败' }, 500);
  }
});

// 导出告警数据
exportRoutes.post('/alerts', authMiddleware, zValidator('json', z.object({
  format: z.enum(['csv', 'excel', 'json']).default('excel'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  severity: z.string().optional(),
})), async (c) => {
  const { format } = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const taskId = crypto.randomUUID();
    exportTasks.set(taskId, {
      id: taskId,
      type: 'alerts',
      format,
      status: 'processing',
      progress: 0,
      createdAt: new Date(),
      createdBy: currentUser.userId,
    });

    setTimeout(() => {
      const task = exportTasks.get(taskId);
      if (task) {
        task.status = 'completed';
        task.progress = 100;
        task.completedAt = new Date();
        task.fileName = `alerts_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : format}`;
        task.fileUrl = `/api/export/download/${taskId}`;
      }
    }, 1500);

    return c.json({
      code: 0,
      message: '导出任务已创建',
      data: { taskId },
    });
  } catch (error) {
    return c.json({ code: 500, message: '创建导出任务失败' }, 500);
  }
});

// 导出审计日志
exportRoutes.post('/audit', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  format: z.enum(['csv', 'excel', 'json']).default('excel'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})), async (c) => {
  const { format } = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const taskId = crypto.randomUUID();
    exportTasks.set(taskId, {
      id: taskId,
      type: 'audit',
      format,
      status: 'processing',
      progress: 0,
      createdAt: new Date(),
      createdBy: currentUser.userId,
    });

    setTimeout(() => {
      const task = exportTasks.get(taskId);
      if (task) {
        task.status = 'completed';
        task.progress = 100;
        task.completedAt = new Date();
        task.fileName = `audit_logs_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : format}`;
        task.fileUrl = `/api/export/download/${taskId}`;
      }
    }, 1500);

    return c.json({
      code: 0,
      message: '导出任务已创建',
      data: { taskId },
    });
  } catch (error) {
    return c.json({ code: 500, message: '创建导出任务失败' }, 500);
  }
});

// 导出拓扑数据
exportRoutes.post('/topology', authMiddleware, zValidator('json', z.object({
  format: z.enum(['json', 'graphml', 'png', 'svg']).default('json'),
})), async (c) => {
  const { format } = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const taskId = crypto.randomUUID();
    exportTasks.set(taskId, {
      id: taskId,
      type: 'topology',
      format,
      status: 'processing',
      progress: 0,
      createdAt: new Date(),
      createdBy: currentUser.userId,
    });

    setTimeout(() => {
      const task = exportTasks.get(taskId);
      if (task) {
        task.status = 'completed';
        task.progress = 100;
        task.completedAt = new Date();
        task.fileName = `topology_${new Date().toISOString().split('T')[0]}.${format}`;
        task.fileUrl = `/api/export/download/${taskId}`;
      }
    }, 2000);

    return c.json({
      code: 0,
      message: '导出任务已创建',
      data: { taskId },
    });
  } catch (error) {
    return c.json({ code: 500, message: '创建导出任务失败' }, 500);
  }
});

// 获取导出任务状态
exportRoutes.get('/tasks/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const task = exportTasks.get(id);

  if (!task) {
    return c.json({ code: 404, message: '任务不存在' }, 404);
  }

  return c.json({ code: 0, data: task });
});

// 获取导出任务列表
exportRoutes.get('/tasks', authMiddleware, async (c) => {
  const currentUser = c.get('user');
  
  const tasks = Array.from(exportTasks.values())
    .filter(t => t.createdBy === currentUser.userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return c.json({ code: 0, data: tasks });
});

// 模拟下载
exportRoutes.get('/download/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const task = exportTasks.get(id);

  if (!task || task.status !== 'completed') {
    return c.json({ code: 404, message: '文件不存在或未完成' }, 404);
  }

  // 模拟返回CSV数据
  const csvContent = 'ID,名称,类型,状态,IP地址,创建时间\n1,设备1,路由器,在线,192.168.1.1,2024-01-01\n2,设备2,交换机,离线,192.168.1.2,2024-01-02';

  return new Response(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${task.fileName}"`,
    },
  });
});

// 可导出的数据类型
exportRoutes.get('/types', authMiddleware, async (c) => {
  const types = [
    { type: 'devices', name: '设备列表', formats: ['csv', 'excel', 'json'], icon: 'desktop' },
    { type: 'alerts', name: '告警数据', formats: ['csv', 'excel', 'json'], icon: 'warning' },
    { type: 'audit', name: '审计日志', formats: ['csv', 'excel', 'json'], icon: 'file-text' },
    { type: 'topology', name: '拓扑数据', formats: ['json', 'graphml', 'png', 'svg'], icon: 'apartment' },
    { type: 'metrics', name: '性能指标', formats: ['csv', 'excel'], icon: 'line-chart' },
    { type: 'config', name: '配置备份', formats: ['zip'], icon: 'file-zip' },
  ];

  return c.json({ code: 0, data: types });
});

export { exportRoutes };
