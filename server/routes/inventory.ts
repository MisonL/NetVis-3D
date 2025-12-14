import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const inventoryRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 盘点任务存储
const inventoryTasks = new Map<string, {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'cancelled';
  progress: number;
  totalDevices: number;
  scannedDevices: number;
  matchedDevices: number;
  unmatchedDevices: number;
  newDevices: number;
  createdBy: string;
  createdAt: Date;
  completedAt?: Date;
}>();

// 资产变更记录
const assetChanges = new Map<string, {
  id: string;
  deviceId: string;
  deviceName: string;
  changeType: 'new' | 'modified' | 'removed' | 'status_change';
  field?: string;
  oldValue?: string;
  newValue?: string;
  detectedAt: Date;
  acknowledged: boolean;
}>();

// 获取资产概览
inventoryRoutes.get('/overview', authMiddleware, async (c) => {
  try {
    const devices = await db.select().from(schema.devices);

    const overview = {
      totalAssets: devices.length,
      onlineAssets: devices.filter(d => d.status === 'online').length,
      offlineAssets: devices.filter(d => d.status === 'offline').length,
      byType: {} as Record<string, number>,
      byLocation: {} as Record<string, number>,
      recentChanges: Array.from(assetChanges.values()).slice(0, 5),
      lastInventory: Array.from(inventoryTasks.values())
        .filter(t => t.status === 'completed')
        .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))[0],
    };

    devices.forEach(d => {
      overview.byType[d.type || '未知'] = (overview.byType[d.type || '未知'] || 0) + 1;
      overview.byLocation[d.location || '未知'] = (overview.byLocation[d.location || '未知'] || 0) + 1;
    });

    return c.json({ code: 0, data: overview });
  } catch (error) {
    return c.json({ code: 500, message: '获取概览失败' }, 500);
  }
});

// 创建盘点任务
inventoryRoutes.post('/tasks', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  name: z.string().min(1),
  scope: z.enum(['all', 'subnet', 'group']).default('all'),
  target: z.string().optional(),
})), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const devices = await db.select().from(schema.devices);
    const id = crypto.randomUUID();

    inventoryTasks.set(id, {
      id,
      name: data.name,
      status: 'running',
      progress: 0,
      totalDevices: devices.length,
      scannedDevices: 0,
      matchedDevices: 0,
      unmatchedDevices: 0,
      newDevices: 0,
      createdBy: currentUser.userId,
      createdAt: new Date(),
    });

    // 模拟盘点过程
    const task = inventoryTasks.get(id);
    if (task) {
      let scanned = 0;
      const interval = setInterval(() => {
        scanned += Math.floor(Math.random() * 3) + 1;
        if (scanned >= devices.length) {
          scanned = devices.length;
          clearInterval(interval);
          task.status = 'completed';
          task.completedAt = new Date();
        }
        task.scannedDevices = scanned;
        task.matchedDevices = Math.floor(scanned * 0.9);
        task.unmatchedDevices = Math.floor(scanned * 0.05);
        task.newDevices = Math.floor(scanned * 0.05);
        task.progress = Math.round((scanned / devices.length) * 100);
      }, 500);
    }

    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'create_inventory',
      resource: 'inventory',
      details: JSON.stringify({ taskId: id, name: data.name }),
    });

    return c.json({
      code: 0,
      message: '盘点任务已创建',
      data: { id },
    });
  } catch (error) {
    return c.json({ code: 500, message: '创建失败' }, 500);
  }
});

// 获取盘点任务列表
inventoryRoutes.get('/tasks', authMiddleware, async (c) => {
  const tasks = Array.from(inventoryTasks.values())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return c.json({ code: 0, data: tasks });
});

// 获取盘点任务详情
inventoryRoutes.get('/tasks/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const task = inventoryTasks.get(id);

  if (!task) {
    return c.json({ code: 404, message: '任务不存在' }, 404);
  }

  return c.json({ code: 0, data: task });
});

// 获取资产变更列表
inventoryRoutes.get('/changes', authMiddleware, async (c) => {
  const changes = Array.from(assetChanges.values())
    .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());

  return c.json({ code: 0, data: changes });
});

// 确认资产变更
inventoryRoutes.put('/changes/:id/acknowledge', authMiddleware, async (c) => {
  const id = c.req.param('id');

  try {
    const change = assetChanges.get(id);
    if (!change) {
      return c.json({ code: 404, message: '变更记录不存在' }, 404);
    }

    change.acknowledged = true;
    return c.json({ code: 0, message: '已确认' });
  } catch (error) {
    return c.json({ code: 500, message: '确认失败' }, 500);
  }
});

// 获取资产统计报表
inventoryRoutes.get('/report', authMiddleware, async (c) => {
  try {
    const devices = await db.select().from(schema.devices);

    const report = {
      summary: {
        totalDevices: devices.length,
        byStatus: {
          online: devices.filter(d => d.status === 'online').length,
          offline: devices.filter(d => d.status === 'offline').length,
          warning: devices.filter(d => d.status === 'warning').length,
        },
      },
      byType: Object.entries(
        devices.reduce((acc, d) => {
          acc[d.type || '未知'] = (acc[d.type || '未知'] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([type, count]) => ({ type, count })),
      byManufacturer: Object.entries(
        devices.reduce((acc, d) => {
          acc[d.manufacturer || '未知'] = (acc[d.manufacturer || '未知'] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([manufacturer, count]) => ({ manufacturer, count })),
      recentTasks: Array.from(inventoryTasks.values())
        .filter(t => t.status === 'completed')
        .slice(0, 5),
    };

    return c.json({ code: 0, data: report });
  } catch (error) {
    return c.json({ code: 500, message: '生成报表失败' }, 500);
  }
});

export { inventoryRoutes };
