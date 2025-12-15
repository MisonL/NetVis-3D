import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc, and, count } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const discoveryRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 发现任务状态存储（实际应使用Redis）
const discoveryTasks = new Map<string, {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  network: string;
  progress: number;
  foundDevices: number;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  results: Array<{
    ip: string;
    hostname?: string;
    type: string;
    vendor?: string;
    status: 'online' | 'offline';
    ports: number[];
  }>;
}>();

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
    const tasks = Array.from(discoveryTasks.values())
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, 20);

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
    const taskId = crypto.randomUUID();
    
    // 创建任务 - 使用完整类型定义
    const task: {
      id: string;
      status: 'pending' | 'running' | 'completed' | 'failed';
      network: string;
      progress: number;
      foundDevices: number;
      startedAt: Date;
      completedAt?: Date;
      error?: string;
      results: Array<{
        ip: string;
        hostname?: string;
        type: string;
        vendor?: string;
        status: 'online' | 'offline';
        ports: number[];
      }>;
    } = {
      id: taskId,
      status: 'pending',
      network,
      progress: 0,
      foundDevices: 0,
      startedAt: new Date(),
      results: [],
    };
    
    discoveryTasks.set(taskId, task);

    // 真实异步发现过程
    (async () => {
      try {
        task.status = 'running';
        
        // 动态导入Node模块
        const { exec } = await import('node:child_process');
        const { Socket } = await import('node:net');
        const util = await import('node:util');
        const execAsync = util.promisify(exec);

        // 端口检测辅助函数
        const checkPort = (ip: string, port: number) => new Promise<boolean>((resolve) => {
          const socket = new Socket();
          socket.setTimeout(1000);
          socket.on('connect', () => { socket.destroy(); resolve(true); });
          socket.on('timeout', () => { socket.destroy(); resolve(false); });
          socket.on('error', () => { socket.destroy(); resolve(false); });
          socket.connect(port, ip);
        });

        // 解析CIDR获取IP范围
        const parts = network.split('/');
        const baseIp = parts[0] || '192.168.1.0';
        const maskBits = parts[1] || '24';
        const ipParts = baseIp.split('.').map(Number);
        const totalHosts = Math.min(254, 254); // 限制单次最大扫描254个IP
        
        let scannedCount = 0;

        // 分批扫描，控制并发
        const batchSize = concurrency;
        for (let i = 0; i < totalHosts; i += batchSize) {
          const batchPromises = [];
          
          for (let j = 0; j < batchSize && (i + j) < totalHosts; j++) {
            const currentIdx = i + j;
            // 简单处理/24网段
            const ip3Base = ipParts[3] || 0;
            const targetIp = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.${(ip3Base + currentIdx + 1) % 256}`;
            
            // 跳过广播地址和网关(通常.1) - 这里不做严格排斥，全部扫一遍
            
            batchPromises.push(async () => {
              try {
                // 1. Ping检测
                try {
                  // Mac/Linux: -c 1 -W 1 (秒). Windows: -n 1 -w 1000 (毫秒)
                  // 假设运行在Mac/Linux容器环境
                  await execAsync(`ping -c 1 -W 1 ${targetIp}`);
                } catch (e) {
                  return null; // Ping不通，跳过
                }

                // 2. 端口检测
                const openPorts: number[] = [];
                for (const port of scanPorts) {
                  if (await checkPort(targetIp, port)) {
                    openPorts.push(port);
                  }
                }

                // 3. 识别设备类型
                let type = 'unknown';
                let vendor = 'Unknown';
                
                if (openPorts.includes(161)) {
                  type = 'switch'; // 暂定，实际应查SNMP
                  vendor = 'Cisco'; // 猜测
                } else if (openPorts.includes(22)) {
                  type = 'linux';
                } else if (openPorts.includes(80) || openPorts.includes(443)) {
                  type = 'server';
                }

                if (openPorts.length > 0) {
                  return {
                    ip: targetIp,
                    hostname: `Device-${targetIp}`,
                    type,
                    vendor,
                    status: 'online' as const,
                    ports: openPorts
                  };
                }
                return null;
              } catch (err) {
                return null;
              }
            });
          }

          // 执行批次
          const results = await Promise.all(batchPromises.map(p => p()));
          
          // 收集结果
          results.forEach(res => {
            if (res) {
              task.results.push(res);
              task.foundDevices++;
            }
          });

          scannedCount += batchPromises.length;
          task.progress = Math.round((scannedCount / totalHosts) * 100);
          
          // 如果任务被取消/失败
          if ((task.status as string) === 'failed') break;
        }

        if ((task.status as string) !== 'failed') {
          task.status = 'completed';
          task.progress = 100;
          task.completedAt = new Date();
        }
      } catch (err) {
        task.status = 'failed';
        task.error = err instanceof Error ? err.message : '发现过程出错';
        task.completedAt = new Date();
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

// 获取发现任务状态
discoveryRoutes.get('/tasks/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');

  try {
    const task = discoveryTasks.get(id);
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
    const task = discoveryTasks.get(id);
    if (!task) {
      return c.json({ code: 404, message: '任务不存在' }, 404);
    }

    return c.json({
      code: 0,
      data: {
        taskId: task.id,
        status: task.status,
        devices: task.results,
        summary: {
          total: task.results.length,
          byType: task.results.reduce((acc, d) => {
            acc[d.type] = (acc[d.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          byVendor: task.results.reduce((acc, d) => {
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
    const task = discoveryTasks.get(taskId);
    if (!task) {
      return c.json({ code: 404, message: '任务不存在' }, 404);
    }

    // 筛选要导入的设备
    const devicesToImport = task.results.filter(d => deviceIps.includes(d.ip));
    
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
          status: device.status,
        });
        importedCount++;
      }
    }

    // 记录审计日志
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
    const task = discoveryTasks.get(id);
    if (!task) {
      return c.json({ code: 404, message: '任务不存在' }, 404);
    }

    if (task.status === 'running' || task.status === 'pending') {
      task.status = 'failed';
      task.error = '用户手动停止';
      task.completedAt = new Date();
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
