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

// 系统日志查询 (Real DB)
logsRoutes.get('/system', authMiddleware, requireRole('admin'), zValidator('query', querySchema), async (c) => {
  const { page, pageSize, level, source, startTime, endTime, keyword } = c.req.valid('query');

  try {
    const offset = (page - 1) * pageSize;
    let query = db.select().from(schema.syslogMessages);
    let countQuery = db.select({ count: count() }).from(schema.syslogMessages);

    // Build Filters
    const conditions = [];
    if (level && level !== 'all') {
        const severityMap: Record<string, number> = { 'error': 3, 'warn': 4, 'info': 6 }; // RFC5424 severity (0-7)
        // Adjust mapping: 0-3 error, 4 warning, 5-6 info? 
        // Simple mapping: level match strict? 
        // We stored integer severity. Filter <= ?
        // Let's assume frontend sends 'error', 'warn', 'info'.
        if (level === 'error') conditions.push(lte(schema.syslogMessages.severity, 3));
        else if (level === 'warn') conditions.push(eq(schema.syslogMessages.severity, 4));
        else if (level === 'info') conditions.push(gte(schema.syslogMessages.severity, 5));
    }
    if (source) {
        conditions.push(eq(schema.syslogMessages.hostname, source));
    }
    if (startTime) {
        conditions.push(gte(schema.syslogMessages.timestamp, new Date(startTime)));
    }
    if (endTime) {
         conditions.push(lte(schema.syslogMessages.timestamp, new Date(endTime)));
    }
    if (keyword) {
        conditions.push(like(schema.syslogMessages.message, `%${keyword}%`));
    }

    if (conditions.length > 0) {
        // @ts-ignore
        const whereClause = and(...conditions);
        // @ts-ignore
        query = query.where(whereClause);
        // @ts-ignore
        countQuery = countQuery.where(whereClause);
    }

    const logs = await query.limit(pageSize).offset(offset).orderBy(desc(schema.syslogMessages.timestamp));
    const totalResult = await countQuery;

    // Convert to frontend format
    const list = logs.map(l => ({
        id: l.id,
        timestamp: l.timestamp,
        level: l.severity <= 3 ? 'error' : l.severity === 4 ? 'warn' : 'info',
        source: l.hostname,
        message: l.message,
        details: l.raw
    }));

    return c.json({
      code: 0,
      data: {
        list,
        total: totalResult[0]?.count || 0,
        page,
        pageSize,
      },
    });
  } catch (error) {
    console.error('Get system logs error:', error);
    return c.json({ code: 500, message: '获取系统日志失败' }, 500);
  }
});

// 获取审计日志（带分页） (Already Real)
logsRoutes.get('/audit', authMiddleware, requireRole('admin'), zValidator('query', querySchema), async (c) => {
  const { page, pageSize } = c.req.valid('query');
  try {
    const offset = (page - 1) * pageSize;
    const logs = await db.select().from(schema.auditLogs).limit(pageSize).offset(offset).orderBy(desc(schema.auditLogs.createdAt));
    const total = await db.select({ count: count() }).from(schema.auditLogs);
    return c.json({ code: 0, data: { list: logs, total: total[0]?.count || 0, page, pageSize } });
  } catch(e) { return c.json({code:500}, 500); }
});


// 获取日志统计 (Real)
logsRoutes.get('/stats', authMiddleware, requireRole('admin'), async (c) => {
  try {
    // Count by severity groups
    const errorCount = (await db.select({ count: count() }).from(schema.syslogMessages).where(lte(schema.syslogMessages.severity, 3)))[0]?.count || 0;
    const warnCount = (await db.select({ count: count() }).from(schema.syslogMessages).where(eq(schema.syslogMessages.severity, 4)))[0]?.count || 0;
    const infoCount = (await db.select({ count: count() }).from(schema.syslogMessages).where(gte(schema.syslogMessages.severity, 5)))[0]?.count || 0;
    const total = errorCount + warnCount + infoCount;

    // By Source (Top 5)
    const sourceResult = await db.select({
      source: schema.syslogMessages.hostname,
      count: count(),
    })
    .from(schema.syslogMessages)
    .groupBy(schema.syslogMessages.hostname)
    .orderBy(desc(count()))
    .limit(5);

    const bySource: Record<string, number> = {};
    sourceResult.forEach(row => {
      if (row.source) bySource[row.source] = row.count;
    });
    
    // Hourly Trend (Last 24h)
    // Using Postgres date_trunc/to_char or similar. Since we used time_bucket elsewhere, we can use that for consistency if TimescaleDB.
    // Fallback to standard SQL for broader compatibility if needed, but project uses TimescaleDB features.
    // timestamp > NOW() - INTERVAL '24 hours'
    
    const hourlyResult = await db.execute(sql`
      SELECT 
        time_bucket('1 hour', timestamp) as bucket,
        COUNT(*) as cnt
      FROM ${schema.syslogMessages}
      WHERE timestamp > NOW() - INTERVAL '24 hours'
      GROUP BY bucket
      ORDER BY bucket ASC
    `);

    const hourly = hourlyResult.map((row: any) => ({
      hour: new Date(row.bucket).getHours() + ':00',
      count: Number(row.cnt)
    }));

    return c.json({
      code: 0,
      data: {
        total,
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


// 清理旧日志 (Real)
logsRoutes.delete('/cleanup', authMiddleware, requireRole('admin'), async (c) => {
  const currentUser = c.get('user');
  const retentionDays = parseInt(c.req.query('days') || '30');
  try {
      const cutoff = new Date(Date.now() - retentionDays * 24 * 3600000);
      const res = await db.delete(schema.syslogMessages).where(lte(schema.syslogMessages.timestamp, cutoff)).returning({ id: schema.syslogMessages.id });
      
      await db.insert(schema.auditLogs).values({
          userId: currentUser.userId, action: 'cleanup_logs', resource: 'syslog', details: JSON.stringify({ deleted: res.length })
      });
      return c.json({ code: 0, message: `已清理 ${res.length} 条日志` });
  } catch(e) {
      return c.json({code:500}, 500);
  }
});

export { logsRoutes };
