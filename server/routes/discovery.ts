import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const discoveryRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 结果类型定义
interface DiscoveryResult {
  ip: string;
  hostname?: string;
  type: string;
  vendor?: string;
  status: 'online' | 'offline';
  ports: number[];
}

// 启动发现任务的Schema
const startDiscoverySchema = z.object({
  network: z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/, 'CIDR格式不正确'),
  scanPorts: z.array(z.number()).default([22, 23, 80, 161, 443, 8080]),
  timeout: z.number().min(1000).max(30000).default(5000),
  concurrency: z.number().min(1).max(100).default(10),
});

// 获取发现任务列表
discoveryRoutes.get('/tasks', authMiddleware, requireRole('admin'), async (c) => {
  try {
    const tasks = await db
      .select()
      .from(schema.discoveryTasks)
      .orderBy(desc(schema.discoveryTasks.startedAt))
      .limit(20);

    return c.json({
      code: 0,
      data: tasks.map(t => ({
        id: t.id,
        network: t.network,
        status: t.status,
        progress: t.progress,
        foundDevices: t.foundDevices,
        startedAt: t.startedAt.toISOString(),
        completedAt: t.completedAt?.toISOString(),
        error: t.error,
      })),
    });
  } catch (error) {
    console.error('Get discovery tasks error:', error);
    return c.json({ code: 500, message: '获取发现任务失败' }, 500);
  }
});

// 启动网络发现
discoveryRoutes.post('/start', authMiddleware, requireRole('admin'), zValidator('json', startDiscoverySchema), async (c) => {
  const { network, scanPorts, timeout, concurrency } = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    // 1. 创建数据库任务记录
    const [newTask] = await db
      .insert(schema.discoveryTasks)
      .values({
        network,
        status: 'pending',
        progress: 0,
        foundDevices: 0,
        result: '[]',
        startedAt: new Date(),
      })
      .returning();

    const taskId = newTask.id;

    // 2. 异步执行发现过程
    (async () => {
      let currentResults: DiscoveryResult[] = [];
      try {
        // 更新状态为运行时
        await db
          .update(schema.discoveryTasks)
          .set({ status: 'running' })
          .where(eq(schema.discoveryTasks.id, taskId));

        // 动态导入Node模块
        const { exec } = await import('node:child_process');
        const { Socket } = await import('node:net');
        const util = await import('node:util');
        const execAsync = util.promisify(exec);

        const checkPort = (ip: string, port: number) => new Promise<boolean>((resolve) => {
          const socket = new Socket();
          socket.setTimeout(1000);
          socket.on('connect', () => { socket.destroy(); resolve(true); });
          socket.on('timeout', () => { socket.destroy(); resolve(false); });
          socket.on('error', () => { socket.destroy(); resolve(false); });
          socket.connect(port, ip);
        });

        // 解析CIDR
        const parts = network.split('/');
        const baseIp = parts[0] || '192.168.1.0';
        // const maskBits = parts[1] || '24';
        const ipParts = baseIp.split('.').map(Number);
        const totalHosts = Math.min(254, 254); // 限制单次最大扫描254个IP
        
        let scannedCount = 0;
        const batchSize = concurrency;

        for (let i = 0; i < totalHosts; i += batchSize) {
          // 检查任务是否被取消 (每次批次前检查数据库状态)
          const [checkTask] = await db
            .select({ status: schema.discoveryTasks.status })
            .from(schema.discoveryTasks)
            .where(eq(schema.discoveryTasks.id, taskId));
          
          if (!checkTask || checkTask.status === 'failed' || checkTask.status === 'completed') {
            break; // 停止执行
          }

          const batchPromises = [];
          for (let j = 0; j < batchSize && (i + j) < totalHosts; j++) {
            const currentIdx = i + j;
            const ip3Base = ipParts[3] || 0;
            const targetIp = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.${(ip3Base + currentIdx + 1) % 256}`;
            
            batchPromises.push(async () => {
              try {
                // Ping
                try {
                  await execAsync(`ping -c 1 -W 1 ${targetIp}`);
                } catch {
                  return null;
                }

                // Ports
                const openPorts: number[] = [];
                for (const port of scanPorts) {
                  if (await checkPort(targetIp, port)) openPorts.push(port);
                }

                if (openPorts.length > 0) {
                  let type = 'unknown';
                  let vendor = 'Unknown';
                  if (openPorts.includes(161)) {
                    type = 'switch';
                    vendor = 'Cisco';
                  } else if (openPorts.includes(22)) {
                    type = 'linux';
                  } else if (openPorts.includes(80) || openPorts.includes(443)) {
                    type = 'server';
                  }

                  return {
                    ip: targetIp,
                    hostname: `Device-${targetIp}`,
                    type,
                    vendor,
                    status: 'online' as const,
                    ports: openPorts
                  } as DiscoveryResult;
                }
                return null;
              } catch {
                return null;
              }
            });
          }

          const results = await Promise.all(batchPromises.map(p => p()));
          
          results.forEach(res => {
            if (res) currentResults.push(res);
          });

          scannedCount += batchPromises.length;
          const progress = Math.round((scannedCount / totalHosts) * 100);

          // 更新进度和当前结果到数据库
          await db
            .update(schema.discoveryTasks)
            .set({ 
              progress,
              foundDevices: currentResults.length,
              result: JSON.stringify(currentResults) // 持久化当前结果
            })
            .where(eq(schema.discoveryTasks.id, taskId));
        }

        // 完成
        await db
          .update(schema.discoveryTasks)
          .set({ 
            status: 'completed',
            progress: 100,
            completedAt: new Date(),
            result: JSON.stringify(currentResults)
          })
          .where(eq(schema.discoveryTasks.id, taskId));

      } catch (err) {
        console.error('Discovery task failed:', err);
        await db
          .update(schema.discoveryTasks)
          .set({ 
            status: 'failed',
            error: err instanceof Error ? err.message : '发现过程出错',
            completedAt: new Date()
          })
          .where(eq(schema.discoveryTasks.id, taskId));
      }
    })();

    // 记录审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'create',
      resource: 'discovery_task',
      resourceId: taskId,
      details: JSON.stringify({ network, scanPorts }),
    });

    return c.json({
      code: 0,
      message: '发现任务已启动',
      data: { taskId },
    });
  } catch (error) {
    console.error('Start discovery error:', error);
    return c.json({ code: 500, message: '启动发现任务失败' }, 500);
  }
});

// 获取发现任务状态 (包含部分结果)
discoveryRoutes.get('/tasks/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  try {
    const [task] = await db
      .select()
      .from(schema.discoveryTasks)
      .where(eq(schema.discoveryTasks.id, id))
      .limit(1);

    if (!task) {
      return c.json({ code: 404, message: '任务不存在' }, 404);
    }

    return c.json({
      code: 0,
      data: {
        id: task.id,
        network: task.network,
        status: task.status,
        progress: task.progress,
        foundDevices: task.foundDevices,
        startedAt: task.startedAt.toISOString(),
        completedAt: task.completedAt?.toISOString(),
        error: task.error,
      },
    });
  } catch (error) {
    console.error('Get discovery task error:', error);
    return c.json({ code: 500, message: '获取任务状态失败' }, 500);
  }
});

// 获取发现结果
discoveryRoutes.get('/tasks/:id/results', authMiddleware, async (c) => {
  const id = c.req.param('id');

  try {
    const [task] = await db
      .select()
      .from(schema.discoveryTasks)
      .where(eq(schema.discoveryTasks.id, id))
      .limit(1);

    if (!task) {
      return c.json({ code: 404, message: '任务不存在' }, 404);
    }

    const results: DiscoveryResult[] = task.result ? JSON.parse(task.result) : [];

    return c.json({
      code: 0,
      data: {
        taskId: task.id,
        status: task.status,
        devices: results,
        summary: {
          total: results.length,
          byType: results.reduce((acc, d) => {
            acc[d.type] = (acc[d.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          byVendor: results.reduce((acc, d) => {
            if (d.vendor) acc[d.vendor] = (acc[d.vendor] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        },
      },
    });
  } catch (error) {
    console.error('Get discovery results error:', error);
    return c.json({ code: 500, message: '获取发现结果失败' }, 500);
  }
});

// 导入发现的设备
const importDevicesSchema = z.object({
  taskId: z.string().uuid(),
  deviceIps: z.array(z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, 'IP格式不正确')),
});

discoveryRoutes.post('/import', authMiddleware, requireRole('admin'), zValidator('json', importDevicesSchema), async (c) => {
  const { taskId, deviceIps } = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const [task] = await db
      .select()
      .from(schema.discoveryTasks)
      .where(eq(schema.discoveryTasks.id, taskId))
      .limit(1);

    if (!task) {
      return c.json({ code: 404, message: '任务不存在' }, 404);
    }

    const results: DiscoveryResult[] = task.result ? JSON.parse(task.result) : [];
    const devicesToImport = results.filter(d => deviceIps.includes(d.ip));
    
    let importedCount = 0;
    for (const device of devicesToImport) {
      // 检查是否已存在
      const existing = await db
        .select()
        .from(schema.devices)
        .where(eq(schema.devices.ipAddress, device.ip))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(schema.devices).values({
          name: device.hostname || `Device-${device.ip}`,
          type: device.type,
          vendor: device.vendor,
          ipAddress: device.ip,
          macAddress: '', // 发现过程可能未获取MAC
          status: device.status,
        });
        importedCount++;
      }
    }

    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'import',
      resource: 'devices',
      details: JSON.stringify({ taskId, importedCount, requestedIps: deviceIps }),
    });

    return c.json({
      code: 0,
      message: `成功导入 ${importedCount} 台设备`,
      data: { importedCount },
    });
  } catch (error) {
    console.error('Import devices error:', error);
    return c.json({ code: 500, message: '导入设备失败' }, 500);
  }
});

// 停止发现任务
discoveryRoutes.post('/tasks/:id/stop', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');

  try {
    const [task] = await db
      .select()
      .from(schema.discoveryTasks)
      .where(eq(schema.discoveryTasks.id, id))
      .limit(1);

    if (!task) {
      return c.json({ code: 404, message: '任务不存在' }, 404);
    }

    if (task.status === 'running' || task.status === 'pending') {
      await db
        .update(schema.discoveryTasks)
        .set({ 
          status: 'failed',
          error: '用户手动停止',
          completedAt: new Date()
        })
        .where(eq(schema.discoveryTasks.id, id));
    }

    return c.json({
      code: 0,
      message: '任务已停止',
    });
  } catch (error) {
    console.error('Stop discovery task error:', error);
    return c.json({ code: 500, message: '停止任务失败' }, 500);
  }
});

export { discoveryRoutes };
