import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc, count, sql } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const logAnalysisRoutes = new Hono<{ Variables: { user: JwtPayload } }>();

// 日志存储
const logs: {
  id: string;
  timestamp: Date;
  device: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  facility: string;
  message: string;
  parsed: Record<string, string>;
}[] = [];

// 日志规则
const logRules = new Map<string, {
  id: string;
  name: string;
  pattern: string;
  level: string;
  action: 'alert' | 'ignore' | 'tag';
  enabled: boolean;
}>();

// 初始化示例数据
['info', 'warning', 'error', 'critical'].forEach((level, li) => {
  for (let i = 0; i < 20; i++) {
    logs.push({
      id: crypto.randomUUID(),
      timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
      device: ['Core-SW1', 'Agg-SW1', 'Router-1', 'Firewall-1'][i % 4]!,
      level: level as 'info' | 'warning' | 'error' | 'critical',
      facility: ['LINK', 'SYS', 'AUTH', 'CONFIG'][i % 4]!,
      message: `Sample ${level} log message #${i + 1}`,
      parsed: {},
    });
  }
});

[
  { id: 'rule-1', name: '接口Down', pattern: 'interface.*down', level: 'error', action: 'alert' as const, enabled: true },
  { id: 'rule-2', name: '登录失败', pattern: 'authentication failed', level: 'warning', action: 'alert' as const, enabled: true },
  { id: 'rule-3', name: 'BGP邻居变化', pattern: 'BGP.*neighbor', level: 'info', action: 'tag' as const, enabled: true },
].forEach(r => logRules.set(r.id, r));

// 获取日志列表 (真实化：查询审计日志)
logAnalysisRoutes.get('/', authMiddleware, async (c) => {
  const level = c.req.query('level');
  const device = c.req.query('device');
  const limit = parseInt(c.req.query('limit') || '100');
  
  try {
    const logs = await db.select().from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(limit);

    // 映射为统一日志格式
    const result = logs.map(l => ({
      id: l.id,
      timestamp: l.createdAt,
      device: 'System', // 审计日志通常关联系统操作
      level: 'info', // 默认为info
      facility: 'AUDIT',
      message: `${l.action} ${l.resource}`,
      parsed: l.details ? JSON.parse(l.details) : {},
    }));
    
    // 如果有syslog表数据，也应该查询并合并 (这里暂略，以审计日志为主)
    
    return c.json({ code: 0, data: result });
  } catch (error) {
    return c.json({ code: 500, message: '获取日志失' }, 500);
  }
});

// 日志统计 (真实化)
logAnalysisRoutes.get('/stats', authMiddleware, async (c) => {
  try {
    const totalResult = await db.select({ count: count() }).from(schema.auditLogs);
    const total = totalResult[0]?.count || 0;

    // 过去24小时趋势
    const trendResult = await db.execute(sql`
      SELECT 
        extract(hour from created_at) as hour,
        count(*)::int as count
      FROM ${schema.auditLogs}
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY 1
      ORDER BY 1
    `);
    
    // @ts-ignore
    const trendRows = trendResult.rows || trendResult;
    const trends = Array.from({ length: 24 }, (_, i) => {
       const h = new Date(Date.now() - (23 - i) * 3600000).getHours();
       const row = trendRows.find((r: any) => r.hour === h);
       return { hour: h, count: row ? Number(row.count) : 0 };
    });

    return c.json({
      code: 0,
      data: {
        total,
        byLevel: { info: total, warning: 0, error: 0, critical: 0 }, // 审计日志全是info
        byDevice: { 'System': total },
        trends,
      },
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取统计失败' }, 500);
  }
});

// 日志搜索
logAnalysisRoutes.post('/search', authMiddleware, zValidator('json', z.object({
  query: z.string(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  devices: z.array(z.string()).optional(),
  levels: z.array(z.string()).optional(),
})), async (c) => {
  const { query, devices, levels } = c.req.valid('json');
  
  let result = logs.filter(l => l.message.toLowerCase().includes(query.toLowerCase()));
  if (devices?.length) result = result.filter(l => devices.includes(l.device));
  if (levels?.length) result = result.filter(l => levels.includes(l.level));
  
  return c.json({ code: 0, data: { total: result.length, logs: result.slice(0, 100) } });
});

// 获取日志规则
logAnalysisRoutes.get('/rules', authMiddleware, async (c) => {
  return c.json({ code: 0, data: Array.from(logRules.values()) });
});

// 创建日志规则
logAnalysisRoutes.post('/rules', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  name: z.string(),
  pattern: z.string(),
  level: z.string(),
  action: z.enum(['alert', 'ignore', 'tag']),
})), async (c) => {
  const data = c.req.valid('json');
  const id = crypto.randomUUID();
  logRules.set(id, { id, ...data, enabled: true });
  return c.json({ code: 0, message: '规则已创建', data: { id } });
});

// 删除日志规则
logAnalysisRoutes.delete('/rules/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  if (!logRules.has(id)) return c.json({ code: 404, message: '规则不存在' }, 404);
  logRules.delete(id);
  return c.json({ code: 0, message: '规则已删除' });
});

// 设备列表
logAnalysisRoutes.get('/devices', authMiddleware, async (c) => {
  const devices = [...new Set(logs.map(l => l.device))];
  return c.json({ code: 0, data: devices });
});

export { logAnalysisRoutes };
