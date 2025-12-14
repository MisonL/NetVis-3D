import { Hono } from 'hono';
import { db, schema } from '../db';
import { eq, desc, and, gte, lte, like, count, sql } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const auditRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 获取审计日志列表
auditRoutes.get('/', authMiddleware, requireRole('admin'), async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const action = c.req.query('action');
    const resource = c.req.query('resource');
    const userId = c.req.query('userId');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    const offset = (page - 1) * pageSize;

    // 构建查询条件
    const conditions = [];
    if (action) conditions.push(eq(schema.auditLogs.action, action));
    if (resource) conditions.push(eq(schema.auditLogs.resource, resource));
    if (userId) conditions.push(eq(schema.auditLogs.userId, userId));
    if (startDate) conditions.push(gte(schema.auditLogs.createdAt, new Date(startDate)));
    if (endDate) conditions.push(lte(schema.auditLogs.createdAt, new Date(endDate)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 查询日志
    const logs = await db
      .select({
        id: schema.auditLogs.id,
        userId: schema.auditLogs.userId,
        action: schema.auditLogs.action,
        resource: schema.auditLogs.resource,
        resourceId: schema.auditLogs.resourceId,
        details: schema.auditLogs.details,
        ipAddress: schema.auditLogs.ipAddress,
        userAgent: schema.auditLogs.userAgent,
        createdAt: schema.auditLogs.createdAt,
        username: schema.users.username,
        displayName: schema.users.displayName,
      })
      .from(schema.auditLogs)
      .leftJoin(schema.users, eq(schema.auditLogs.userId, schema.users.id))
      .where(whereClause)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(pageSize)
      .offset(offset);

    // 统计总数
    const countResult = await db
      .select({ total: count() })
      .from(schema.auditLogs)
      .where(whereClause);
    const total = countResult[0]?.total ?? 0;

    return c.json({
      code: 0,
      data: {
        list: logs.map(log => ({
          ...log,
          details: log.details ? JSON.parse(log.details) : null,
        })),
        pagination: {
          page,
          pageSize,
          total: Number(total),
          totalPages: Math.ceil(Number(total) / pageSize),
        },
      },
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    return c.json({ code: 500, message: '获取审计日志失败' }, 500);
  }
});

// 获取审计统计
auditRoutes.get('/stats', authMiddleware, requireRole('admin'), async (c) => {
  try {
    // 按操作类型统计
    const byAction = await db
      .select({
        action: schema.auditLogs.action,
        count: count(),
      })
      .from(schema.auditLogs)
      .groupBy(schema.auditLogs.action);

    // 按资源类型统计
    const byResource = await db
      .select({
        resource: schema.auditLogs.resource,
        count: count(),
      })
      .from(schema.auditLogs)
      .groupBy(schema.auditLogs.resource);

    // 最近7天趋势
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentLogs = await db
      .select()
      .from(schema.auditLogs)
      .where(gte(schema.auditLogs.createdAt, sevenDaysAgo));

    // 按日期分组
    const dailyCounts: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      if (dateStr) dailyCounts[dateStr] = 0;
    }
    recentLogs.forEach(log => {
      const dateStr = log.createdAt.toISOString().split('T')[0];
      if (dateStr && dailyCounts[dateStr] !== undefined) {
        dailyCounts[dateStr]++;
      }
    });

    return c.json({
      code: 0,
      data: {
        byAction: byAction.map(a => ({ action: a.action, count: Number(a.count) })),
        byResource: byResource.map(r => ({ resource: r.resource, count: Number(r.count) })),
        dailyTrend: Object.entries(dailyCounts)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      },
    });
  } catch (error) {
    console.error('Get audit stats error:', error);
    return c.json({ code: 500, message: '获取审计统计失败' }, 500);
  }
});

// 记录审计日志（内部使用）
export const logAudit = async (
  userId: string | null,
  action: string,
  resource: string,
  resourceId?: string,
  details?: object,
  ipAddress?: string,
  userAgent?: string
) => {
  try {
    await db.insert(schema.auditLogs).values({
      userId,
      action,
      resource,
      resourceId,
      details: details ? JSON.stringify(details) : null,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error('Log audit error:', error);
  }
};

// 导出审计日志
auditRoutes.get('/export', authMiddleware, requireRole('admin'), async (c) => {
  try {
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    const conditions = [];
    if (startDate) conditions.push(gte(schema.auditLogs.createdAt, new Date(startDate)));
    if (endDate) conditions.push(lte(schema.auditLogs.createdAt, new Date(endDate)));

    const logs = await db
      .select({
        id: schema.auditLogs.id,
        action: schema.auditLogs.action,
        resource: schema.auditLogs.resource,
        resourceId: schema.auditLogs.resourceId,
        details: schema.auditLogs.details,
        ipAddress: schema.auditLogs.ipAddress,
        createdAt: schema.auditLogs.createdAt,
        username: schema.users.username,
      })
      .from(schema.auditLogs)
      .leftJoin(schema.users, eq(schema.auditLogs.userId, schema.users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(10000);

    // 生成CSV
    const headers = ['时间', '用户', '操作', '资源类型', '资源ID', 'IP地址', '详情'];
    const rows = logs.map(log => [
      log.createdAt.toISOString(),
      log.username || '-',
      log.action,
      log.resource,
      log.resourceId || '-',
      log.ipAddress || '-',
      log.details || '-',
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit_logs_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export audit logs error:', error);
    return c.json({ code: 500, message: '导出审计日志失败' }, 500);
  }
});

export { auditRoutes };
