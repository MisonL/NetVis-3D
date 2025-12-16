import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc, count, sql } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';
import crypto from 'crypto';

const apiStatsRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// API调用记录存储
const apiCalls: Array<{
  id: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  apiKeyId?: string;
  userId?: string;
  ipAddress: string;
  userAgent?: string;
  timestamp: Date;
}> = [];

// API调用记录存储 (TODO: Persist to DB)
// const apiCalls: Array<...> = [];

// 获取API调用统计概览
apiStatsRoutes.get('/overview', authMiddleware, requireRole('admin'), async (c) => {
  try {
    const now = Date.now();
    const oneDayAgo = now - 86400000;
    const oneHourAgo = now - 3600000;

    const allCalls = apiCalls;
    const dailyCalls = allCalls.filter(c => c.timestamp.getTime() >= oneDayAgo);
    const hourlyCalls = allCalls.filter(c => c.timestamp.getTime() >= oneHourAgo);

    const totalCalls = allCalls.length;
    const dailyTotal = dailyCalls.length;
    const hourlyTotal = hourlyCalls.length;

    // 成功率
    const successCalls = allCalls.filter(c => c.statusCode >= 200 && c.statusCode < 300).length;
    const successRate = totalCalls ? (successCalls / totalCalls * 100).toFixed(2) : 0;

    // 平均响应时间
    const avgResponseTime = allCalls.length
      ? (allCalls.reduce((sum, c) => sum + c.responseTime, 0) / allCalls.length).toFixed(2)
      : 0;

    // 按端点统计
    const byEndpoint: Record<string, number> = {};
    allCalls.forEach(c => {
      byEndpoint[c.endpoint] = (byEndpoint[c.endpoint] || 0) + 1;
    });

    // 按状态码统计
    const byStatusCode: Record<number, number> = {};
    allCalls.forEach(c => {
      byStatusCode[c.statusCode] = (byStatusCode[c.statusCode] || 0) + 1;
    });

    // 按方法统计
    const byMethod: Record<string, number> = {};
    allCalls.forEach(c => {
      byMethod[c.method] = (byMethod[c.method] || 0) + 1;
    });

    return c.json({
      code: 0,
      data: {
        totalCalls,
        dailyTotal,
        hourlyTotal,
        successRate,
        avgResponseTime,
        byEndpoint: Object.entries(byEndpoint)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10),
        byStatusCode,
        byMethod,
      },
    });
  } catch (error) {
    console.error('Get API stats error:', error);
    return c.json({ code: 500, message: '获取API统计失败' }, 500);
  }
});

// 获取API调用列表
apiStatsRoutes.get('/calls', authMiddleware, requireRole('admin'), async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const pageSize = parseInt(c.req.query('pageSize') || '20');
  const endpoint = c.req.query('endpoint');
  const method = c.req.query('method');
  const status = c.req.query('status');

  try {
    let filtered = [...apiCalls];

    if (endpoint) {
      filtered = filtered.filter(c => c.endpoint.includes(endpoint));
    }
    if (method) {
      filtered = filtered.filter(c => c.method === method);
    }
    if (status === 'success') {
      filtered = filtered.filter(c => c.statusCode >= 200 && c.statusCode < 300);
    } else if (status === 'error') {
      filtered = filtered.filter(c => c.statusCode >= 400);
    }

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const data = filtered.slice(start, start + pageSize);

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
    return c.json({ code: 500, message: '获取调用列表失败' }, 500);
  }
});

// 获取API趋势数据
apiStatsRoutes.get('/trend', authMiddleware, requireRole('admin'), async (c) => {
  const hours = parseInt(c.req.query('hours') || '24');

  try {
    const now = Date.now();
    const trend: { hour: string; calls: number; errors: number; avgTime: number }[] = [];

    for (let i = hours - 1; i >= 0; i--) {
      const hourStart = now - (i + 1) * 3600000;
      const hourEnd = now - i * 3600000;
      
      const hourCalls = apiCalls.filter(c => 
        c.timestamp.getTime() >= hourStart && c.timestamp.getTime() < hourEnd
      );

      const errors = hourCalls.filter(c => c.statusCode >= 400).length;
      const avgTime = hourCalls.length
        ? hourCalls.reduce((sum, c) => sum + c.responseTime, 0) / hourCalls.length
        : 0;

      trend.push({
        hour: new Date(hourEnd).toISOString().slice(0, 13) + ':00',
        calls: hourCalls.length,
        errors,
        avgTime: Math.round(avgTime),
      });
    }

    return c.json({
      code: 0,
      data: trend,
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取趋势失败' }, 500);
  }
});

// 获取慢请求列表
apiStatsRoutes.get('/slow', authMiddleware, requireRole('admin'), async (c) => {
  const threshold = parseInt(c.req.query('threshold') || '100');
  const limit = parseInt(c.req.query('limit') || '20');

  try {
    const slowCalls = apiCalls
      .filter(c => c.responseTime >= threshold)
      .sort((a, b) => b.responseTime - a.responseTime)
      .slice(0, limit);

    return c.json({
      code: 0,
      data: slowCalls,
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取慢请求失败' }, 500);
  }
});

// 获取错误请求统计
apiStatsRoutes.get('/errors', authMiddleware, requireRole('admin'), async (c) => {
  try {
    const errorCalls = apiCalls.filter(c => c.statusCode >= 400);

    // 按端点分组错误
    const byEndpoint: Record<string, number> = {};
    errorCalls.forEach(c => {
      byEndpoint[c.endpoint] = (byEndpoint[c.endpoint] || 0) + 1;
    });

    // 按状态码分组
    const byCode: Record<number, number> = {};
    errorCalls.forEach(c => {
      byCode[c.statusCode] = (byCode[c.statusCode] || 0) + 1;
    });

    return c.json({
      code: 0,
      data: {
        total: errorCalls.length,
        rate: apiCalls.length ? (errorCalls.length / apiCalls.length * 100).toFixed(2) : 0,
        byEndpoint: Object.entries(byEndpoint).sort((a, b) => b[1] - a[1]),
        byCode,
        recent: errorCalls.slice(0, 10),
      },
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取错误统计失败' }, 500);
  }
});

// 记录API调用（供中间件使用）
apiStatsRoutes.post('/record', async (c) => {
  const body = await c.req.json();

  try {
    apiCalls.unshift({
      id: crypto.randomUUID(),
      endpoint: body.endpoint,
      method: body.method,
      statusCode: body.statusCode,
      responseTime: body.responseTime,
      apiKeyId: body.apiKeyId,
      userId: body.userId,
      ipAddress: body.ipAddress || 'unknown',
      userAgent: body.userAgent,
      timestamp: new Date(),
    });

    // 保持最多10000条记录
    if (apiCalls.length > 10000) {
      apiCalls.length = 10000;
    }

    return c.json({ code: 0 });
  } catch (error) {
    return c.json({ code: 500 }, 500);
  }
});

export { apiStatsRoutes };
