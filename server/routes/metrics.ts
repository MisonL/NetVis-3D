import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const metricsRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 查询参数
const querySchema = z.object({
  deviceId: z.string().uuid().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  interval: z.enum(['1m', '5m', '15m', '1h', '6h', '1d']).optional(),
  limit: z.string().optional().transform(v => parseInt(v || '100')),
});

// 获取设备指标
metricsRoutes.get('/device/:id', authMiddleware, async (c) => {
  const deviceId = c.req.param('id');
  const limit = parseInt(c.req.query('limit') || '100');
  const startTime = c.req.query('startTime');
  const endTime = c.req.query('endTime');

  try {
    let query = db
      .select()
      .from(schema.deviceMetrics)
      .where(eq(schema.deviceMetrics.deviceId, deviceId))
      .orderBy(desc(schema.deviceMetrics.timestamp))
      .limit(limit);

    const metrics = await query;

    return c.json({
      code: 0,
      data: metrics,
    });
  } catch (error) {
    console.error('Get device metrics error:', error);
    return c.json({ code: 500, message: '获取设备指标失败' }, 500);
  }
});

// 获取接口流量指标
metricsRoutes.get('/interface/:deviceId', authMiddleware, async (c) => {
  const deviceId = c.req.param('deviceId');
  const interfaceName = c.req.query('interface');
  const limit = parseInt(c.req.query('limit') || '100');

  try {
    const conditions = [eq(schema.interfaceMetrics.deviceId, deviceId)];
    if (interfaceName) {
      conditions.push(eq(schema.interfaceMetrics.interfaceName, interfaceName));
    }

    const metrics = await db
      .select()
      .from(schema.interfaceMetrics)
      .where(and(...conditions))
      .orderBy(desc(schema.interfaceMetrics.timestamp))
      .limit(limit);

    return c.json({
      code: 0,
      data: metrics,
    });
  } catch (error) {
    console.error('Get interface metrics error:', error);
    return c.json({ code: 500, message: '获取接口指标失败' }, 500);
  }
});

// 获取聚合统计 (真实TimescaleDB查询)
metricsRoutes.get('/aggregated', authMiddleware, zValidator('query', querySchema), async (c) => {
  const { deviceId, startTime, endTime, interval = '1h', limit } = c.req.valid('query');

  try {
    // TimescaleDB time_bucket interval map
    const bucketInterval = {
      '1m': '1 minute',
      '5m': '5 minutes',
      '15m': '15 minutes',
      '1h': '1 hour',
      '6h': '6 hours',
      '1d': '1 day',
    }[interval];

    const conditions = [];
    if (deviceId) conditions.push(sql`device_id = ${deviceId}`);
    if (startTime) conditions.push(sql`timestamp >= ${startTime}`);
    if (endTime) conditions.push(sql`timestamp <= ${endTime}`);

    const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

    const query = sql`
      SELECT
        time_bucket(${sql.raw(`'${bucketInterval}'`)}, timestamp) AS bucket,
        AVG(latency)::numeric(10,2) as avg_latency,
        MAX(latency)::numeric(10,2) as max_latency,
        MIN(latency)::numeric(10,2) as min_latency,
        AVG(cpu_usage)::numeric(10,2) as avg_cpu,
        AVG(memory_usage)::numeric(10,2) as avg_memory,
        (COUNT(*) FILTER (WHERE status = 'online') * 100.0 / COUNT(*))::numeric(10,2) as online_rate
      FROM ${schema.deviceMetrics}
      ${whereClause}
      GROUP BY bucket
      ORDER BY bucket DESC
      LIMIT ${limit || 24}
    `;

    // @ts-ignore
    const result = await db.execute(query);
    // @ts-ignore
    const rows = result.rows || result;

    const data = rows.map((row: any) => ({
      timestamp: row.bucket,
      avgLatency: Number(row.avg_latency),
      maxLatency: Number(row.max_latency),
      minLatency: Number(row.min_latency),
      avgCpu: Number(row.avg_cpu),
      avgMemory: Number(row.avg_memory),
      onlineRate: Number(row.online_rate || 0),
    }));

    return c.json({
      code: 0,
      data: data.reverse(), // 按时间正序
    });
  } catch (error) {
    console.error('Get aggregated metrics error:', error);
    return c.json({ code: 500, message: '获取聚合指标失败' }, 500);
  }
});

// 获取实时仪表盘数据
metricsRoutes.get('/dashboard', authMiddleware, async (c) => {
  try {
    const devices = await db.select().from(schema.devices);
    
    // 获取最新指标平均值
    const latestMetrics = await db.execute(sql`
      SELECT 
        AVG(latency)::numeric(10,1) as avg_latency,
        AVG(cpu_usage)::numeric(10,1) as avg_cpu,
        AVG(memory_usage)::numeric(10,1) as avg_memory
      FROM ${schema.deviceMetrics}
      WHERE timestamp >= NOW() - INTERVAL '5 minutes'
    `);
    
    // @ts-ignore
    const metricsRow = (latestMetrics.rows || latestMetrics)[0] || {};

    const stats = {
      totalDevices: devices.length,
      onlineDevices: devices.filter(d => d.status === 'online').length,
      offlineDevices: devices.filter(d => d.status === 'offline').length,
      warningDevices: devices.filter(d => d.status === 'warning').length,
      avgLatency: Number(metricsRow.avg_latency || 0),
      avgCpu: Number(metricsRow.avg_cpu || 0),
      avgMemory: Number(metricsRow.avg_memory || 0),
      // 流量统计仍需从接口表获取，暂保留基础值
      totalTrafficIn: 0, 
      totalTrafficOut: 0,
    };

    // 最近24小时趋势（TimescaleDB）
    const trendResult = await db.execute(sql`
      SELECT
        EXTRACT(HOUR FROM time_bucket('1 hour', timestamp)) as hour,
        AVG(latency) as latency,
        (COUNT(*) FILTER (WHERE status = 'online') * 100.0 / COUNT(*)) as online_rate
      FROM ${schema.deviceMetrics}
      WHERE timestamp >= NOW() - INTERVAL '24 hours'
      GROUP BY 1
      ORDER BY 1
    `);

    // @ts-ignore
    const trendRows = trendResult.rows || trendResult;
    const trend = trendRows.map((row: any) => ({
      hour: Number(row.hour),
      online: Math.round(Number(row.online_rate || 0) * devices.length / 100), // 估算在线数
      latency: Number(row.latency || 0),
    }));

    return c.json({
      code: 0,
      data: {
        stats,
        trend,
      },
    });
  } catch (error) {
    console.error('Get dashboard metrics error:', error);
    return c.json({ code: 500, message: '获取仪表盘数据失败' }, 500);
  }
});

// 获取Top N设备
metricsRoutes.get('/top', authMiddleware, async (c) => {
  const metric = c.req.query('metric') || 'latency'; // latency, cpu, memory
  const limit = parseInt(c.req.query('limit') || '10');

  try {
    let orderByField;
    switch(metric) {
      case 'latency': orderByField = sql`AVG(latency)`; break;
      case 'cpu': orderByField = sql`AVG(cpu_usage)`; break;
      case 'memory': orderByField = sql`AVG(memory_usage)`; break;
      default: orderByField = sql`AVG(latency)`;
    }

    const query = sql`
      SELECT
        d.id as device_id,
        d.name as device_name,
        d.ip_address,
        ${orderByField}::numeric(10,2) as value
      FROM ${schema.deviceMetrics} m
      JOIN ${schema.devices} d ON m.device_id = d.id
      WHERE m.timestamp >= NOW() - INTERVAL '1 hour'
      GROUP BY d.id, d.name, d.ip_address
      ORDER BY value DESC
      LIMIT ${limit}
    `;

    // @ts-ignore
    const result = await db.execute(query);
    // @ts-ignore
    const rows = result.rows || result;

    const topDevices = rows.map((row: any) => ({
      deviceId: row.device_id,
      deviceName: row.device_name,
      ip: row.ip_address,
      value: Number(row.value),
    }));

    return c.json({
      code: 0,
      data: topDevices,
    });
  } catch (error) {
    console.error('Get top devices error:', error);
    return c.json({ code: 500, message: '获取Top设备失败' }, 500);
  }
});

// 保存指标数据 (内部接口)
metricsRoutes.post('/store', async (c) => {
  try {
    const { deviceId, collectorId, metrics } = await c.req.json();

    await db.insert(schema.deviceMetrics).values({
      deviceId,
      collectorId,
      status: metrics.status,
      latency: Math.round(metrics.latency),
      packetLoss: Math.round(metrics.packetLoss || 0),
      cpuUsage: Math.round(metrics.cpuUsage || 0),
      memoryUsage: Math.round(metrics.memoryUsage || 0),
      uptime: metrics.uptime,
    });

    return c.json({ code: 0, message: 'OK' });
  } catch (error) {
    console.error('Store metrics error:', error);
    return c.json({ code: 500, message: '存储指标失败' }, 500);
  }
});

export { metricsRoutes };
