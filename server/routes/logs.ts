import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc, and, gte, lte, like, sql, count } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const logsRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 查询参数Schema
const querySchema = z.object({
  page: z.string().optional().transform(v => parseInt(v || '1')),
  pageSize: z.string().optional().transform(v => parseInt(v || '20')),
  level: z.enum(['all', 'info', 'warn', 'error']).optional(),
  source: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  keyword: z.string().optional(),
});

// 系统日志存储（实际应使用专门的日志系统）
const systemLogs: Array<{
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  source: string;
  message: string;
  details?: string;
}> = [];

// 模拟日志生成
const generateMockLogs = () => {
  const sources = ['server', 'database', 'auth', 'api', 'collector', 'scheduler'];
  const levels: Array<'info' | 'warn' | 'error'> = ['info', 'warn', 'error'];
  const messages = {
    info: [
      '用户登录成功',
      '设备状态更新',
      'API请求处理完成',
      '定时任务执行',
      '采集器心跳正常',
      '数据库连接正常',
    ],
    warn: [
      '设备响应超时',
      '内存使用率超过80%',
      'API请求响应时间过长',
      '备份存储空间不足',
      'SNMP连接重试',
    ],
    error: [
      '数据库连接失败',
      '设备离线告警',
      'API请求失败',
      '认证失败',
      '采集器连接断开',
    ],
  };

  const now = Date.now();
  for (let i = 0; i < 200; i++) {
    const levelIndex = Math.floor(Math.random() * (i < 20 ? 3 : 2));
    const level = levels[levelIndex] || 'info';
    const sourceIndex = Math.floor(Math.random() * sources.length);
    const source = sources[sourceIndex] || 'server';
    const msgs = messages[level];
    
    systemLogs.push({
      id: crypto.randomUUID(),
      timestamp: new Date(now - i * 60000 * Math.random() * 10),
      level,
      source,
      message: msgs[Math.floor(Math.random() * msgs.length)] || '',
      details: Math.random() > 0.7 ? JSON.stringify({ ip: '192.168.1.' + Math.floor(Math.random() * 255) }) : undefined,
    });
  }

  // 按时间排序
  systemLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

generateMockLogs();

// 获取系统日志
logsRoutes.get('/system', authMiddleware, requireRole('admin'), zValidator('query', querySchema), async (c) => {
  const { page, pageSize, level, source, startTime, endTime, keyword } = c.req.valid('query');

  try {
    let filteredLogs = [...systemLogs];

    // 过滤
    if (level && level !== 'all') {
      filteredLogs = filteredLogs.filter(l => l.level === level);
    }
    if (source) {
      filteredLogs = filteredLogs.filter(l => l.source === source);
    }
    if (startTime) {
      const start = new Date(startTime);
      filteredLogs = filteredLogs.filter(l => l.timestamp >= start);
    }
    if (endTime) {
      const end = new Date(endTime);
      filteredLogs = filteredLogs.filter(l => l.timestamp <= end);
    }
    if (keyword) {
      filteredLogs = filteredLogs.filter(l => 
        l.message.includes(keyword) || (l.details && l.details.includes(keyword))
      );
    }

    const total = filteredLogs.length;
    const start = (page - 1) * pageSize;
    const data = filteredLogs.slice(start, start + pageSize);

    return c.json({
      code: 0,
      data: {
        list: data,
        total,
        page,
        pageSize,
      },
    });
  } catch (error) {
    console.error('Get system logs error:', error);
    return c.json({ code: 500, message: '获取系统日志失败' }, 500);
  }
});

// 获取审计日志（带分页）
logsRoutes.get('/audit', authMiddleware, requireRole('admin'), zValidator('query', querySchema), async (c) => {
  const { page, pageSize, startTime, endTime, keyword } = c.req.valid('query');

  try {
    const offset = (page - 1) * pageSize;
    
    // 获取审计日志
    const logs = await db
      .select({
        id: schema.auditLogs.id,
        userId: schema.auditLogs.userId,
        action: schema.auditLogs.action,
        resource: schema.auditLogs.resource,
        resourceId: schema.auditLogs.resourceId,
        details: schema.auditLogs.details,
        ipAddress: schema.auditLogs.ipAddress,
        createdAt: schema.auditLogs.createdAt,
      })
      .from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(pageSize)
      .offset(offset);

    // 获取总数
    const totalResult = await db
      .select({ count: count() })
      .from(schema.auditLogs);

    return c.json({
      code: 0,
      data: {
        list: logs,
        total: totalResult[0]?.count || 0,
        page,
        pageSize,
      },
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    return c.json({ code: 500, message: '获取审计日志失败' }, 500);
  }
});

// 获取日志统计
logsRoutes.get('/stats', authMiddleware, requireRole('admin'), async (c) => {
  try {
    const infoCount = systemLogs.filter(l => l.level === 'info').length;
    const warnCount = systemLogs.filter(l => l.level === 'warn').length;
    const errorCount = systemLogs.filter(l => l.level === 'error').length;

    // 按来源统计
    const bySource: Record<string, number> = {};
    systemLogs.forEach(l => {
      bySource[l.source] = (bySource[l.source] || 0) + 1;
    });

    // 最近24小时趋势
    const now = Date.now();
    const hourly: { hour: number; count: number }[] = [];
    for (let i = 23; i >= 0; i--) {
      const hourStart = now - (i + 1) * 3600000;
      const hourEnd = now - i * 3600000;
      const count = systemLogs.filter(l => 
        l.timestamp.getTime() >= hourStart && l.timestamp.getTime() < hourEnd
      ).length;
      hourly.push({ hour: 23 - i, count });
    }

    return c.json({
      code: 0,
      data: {
        total: systemLogs.length,
        byLevel: { info: infoCount, warn: warnCount, error: errorCount },
        bySource,
        hourly,
      },
    });
  } catch (error) {
    console.error('Get log stats error:', error);
    return c.json({ code: 500, message: '获取日志统计失败' }, 500);
  }
});

// 清理旧日志
logsRoutes.delete('/cleanup', authMiddleware, requireRole('admin'), async (c) => {
  const currentUser = c.get('user');

  try {
    const retentionDays = parseInt(c.req.query('days') || '30');
    const cutoff = new Date(Date.now() - retentionDays * 24 * 3600000);

    const beforeCount = systemLogs.length;
    const remaining = systemLogs.filter(l => l.timestamp >= cutoff);
    systemLogs.length = 0;
    systemLogs.push(...remaining);
    const deletedCount = beforeCount - remaining.length;

    // 审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'cleanup',
      resource: 'system_logs',
      details: JSON.stringify({ retentionDays, deletedCount }),
    });

    return c.json({
      code: 0,
      message: `已清理 ${deletedCount} 条日志`,
    });
  } catch (error) {
    console.error('Cleanup logs error:', error);
    return c.json({ code: 500, message: '清理日志失败' }, 500);
  }
});

export { logsRoutes };
