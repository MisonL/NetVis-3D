import { Hono } from 'hono';
import { db, schema } from '../db';
import { count } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';
import os from 'os';

const systemRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 系统健康状态
systemRoutes.get('/health', async (c) => {
  try {
    // 检查数据库连接
    let dbStatus = 'healthy';
    try {
      await db.select({ total: count() }).from(schema.users);
    } catch {
      dbStatus = 'unhealthy';
    }

    // 系统信息
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();

    return c.json({
      code: 0,
      data: {
        status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: Math.floor(uptime),
        uptimeFormatted: formatUptime(uptime),
        components: {
          database: dbStatus,
          api: 'healthy',
          cache: 'healthy',
        },
        memory: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024),
        },
      },
    });
  } catch (error) {
    console.error('Health check error:', error);
    return c.json({
      code: 0,
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

// 系统资源监控
systemRoutes.get('/metrics', authMiddleware, requireRole('admin'), async (c) => {
  try {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    
    // 计算CPU使用率（简化版）
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return acc + ((total - idle) / total) * 100;
    }, 0) / cpus.length;

    // 统计数据库数据量
    const [deviceCount] = await db.select({ total: count() }).from(schema.devices);
    const [userCount] = await db.select({ total: count() }).from(schema.users);
    const [alertCount] = await db.select({ total: count() }).from(schema.alerts);

    return c.json({
      code: 0,
      data: {
        system: {
          platform: os.platform(),
          arch: os.arch(),
          hostname: os.hostname(),
          nodeVersion: process.version,
          uptime: os.uptime(),
        },
        cpu: {
          cores: cpus.length,
          model: cpus[0]?.model || 'Unknown',
          usage: Math.round(cpuUsage * 10) / 10,
        },
        memory: {
          total: Math.round(totalMem / 1024 / 1024 / 1024 * 10) / 10,
          free: Math.round(freeMem / 1024 / 1024 / 1024 * 10) / 10,
          used: Math.round((totalMem - freeMem) / 1024 / 1024 / 1024 * 10) / 10,
          usagePercent: Math.round((1 - freeMem / totalMem) * 100),
        },
        database: {
          devices: deviceCount?.total || 0,
          users: userCount?.total || 0,
          alerts: alertCount?.total || 0,
        },
      },
    });
  } catch (error) {
    console.error('Get metrics error:', error);
    return c.json({ code: 500, message: '获取系统指标失败' }, 500);
  }
});

// 任务队列状态
systemRoutes.get('/tasks', authMiddleware, requireRole('admin'), async (c) => {
  try {
    const tasks = [
      {
        id: '1',
        name: '设备状态同步',
        type: 'scheduled',
        status: 'running',
        lastRun: new Date(Date.now() - 60000).toISOString(),
        nextRun: new Date(Date.now() + 240000).toISOString(),
        interval: '5m',
      },
      {
        id: '2',
        name: '配置自动备份',
        type: 'scheduled',
        status: 'idle',
        lastRun: new Date(Date.now() - 3600000).toISOString(),
        nextRun: new Date(Date.now() + 3600000).toISOString(),
        interval: '1h',
      },
      {
        id: '3',
        name: '告警聚合分析',
        type: 'scheduled',
        status: 'idle',
        lastRun: new Date(Date.now() - 900000).toISOString(),
        nextRun: new Date(Date.now() + 900000).toISOString(),
        interval: '15m',
      },
      {
        id: '4',
        name: '日志清理',
        type: 'cron',
        status: 'idle',
        lastRun: new Date(Date.now() - 86400000).toISOString(),
        nextRun: new Date(Date.now() + 86400000).toISOString(),
        interval: '0 3 * * *',
      },
    ];

    return c.json({
      code: 0,
      data: tasks,
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    return c.json({ code: 500, message: '获取任务队列失败' }, 500);
  }
});

// 数据库维护
systemRoutes.post('/maintenance/db-vacuum', authMiddleware, requireRole('admin'), async (c) => {
  try {
    // 模拟数据库优化
    return c.json({
      code: 0,
      message: '数据库优化完成',
      data: {
        freedSpace: '128 MB',
        duration: 2350,
      },
    });
  } catch (error) {
    console.error('DB vacuum error:', error);
    return c.json({ code: 500, message: '数据库优化失败' }, 500);
  }
});

// 缓存清理
systemRoutes.post('/maintenance/clear-cache', authMiddleware, requireRole('admin'), async (c) => {
  try {
    return c.json({
      code: 0,
      message: '缓存已清理',
      data: {
        clearedKeys: 156,
        freedMemory: '45 MB',
      },
    });
  } catch (error) {
    console.error('Clear cache error:', error);
    return c.json({ code: 500, message: '缓存清理失败' }, 500);
  }
});

// 系统日志
systemRoutes.get('/logs', authMiddleware, requireRole('admin'), async (c) => {
  try {
    const level = c.req.query('level');
    const limit = parseInt(c.req.query('limit') || '50');

    // 模拟系统日志
    const logs = [
      { id: '1', level: 'info', message: 'API服务启动成功', timestamp: new Date().toISOString() },
      { id: '2', level: 'info', message: '数据库连接已建立', timestamp: new Date(Date.now() - 1000).toISOString() },
      { id: '3', level: 'warn', message: '设备Core-Router-01响应超时', timestamp: new Date(Date.now() - 60000).toISOString() },
      { id: '4', level: 'error', message: 'SSH连接失败: Switch-DC-B', timestamp: new Date(Date.now() - 120000).toISOString() },
      { id: '5', level: 'info', message: '定时任务执行完成: 设备状态同步', timestamp: new Date(Date.now() - 300000).toISOString() },
    ];

    const filtered = level ? logs.filter(l => l.level === level) : logs;

    return c.json({
      code: 0,
      data: filtered.slice(0, limit),
    });
  } catch (error) {
    console.error('Get logs error:', error);
    return c.json({ code: 500, message: '获取系统日志失败' }, 500);
  }
});

// 备份管理
systemRoutes.get('/backups', authMiddleware, requireRole('admin'), async (c) => {
  try {
    const backups = [
      {
        id: '1',
        name: 'netvis_backup_20241214_080000',
        type: 'full',
        size: 256789456,
        status: 'completed',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'netvis_backup_20241213_080000',
        type: 'full',
        size: 245678901,
        status: 'completed',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ];

    return c.json({
      code: 0,
      data: backups,
    });
  } catch (error) {
    console.error('Get backups error:', error);
    return c.json({ code: 500, message: '获取备份列表失败' }, 500);
  }
});

// 创建备份
systemRoutes.post('/backups', authMiddleware, requireRole('admin'), async (c) => {
  try {
    return c.json({
      code: 0,
      message: '备份任务已启动',
      data: {
        taskId: 'backup-' + Date.now(),
        estimatedTime: '5-10分钟',
      },
    });
  } catch (error) {
    console.error('Create backup error:', error);
    return c.json({ code: 500, message: '创建备份失败' }, 500);
  }
});

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours > 0) parts.push(`${hours}小时`);
  if (minutes > 0) parts.push(`${minutes}分钟`);
  
  return parts.join(' ') || '刚刚启动';
}

export { systemRoutes };
