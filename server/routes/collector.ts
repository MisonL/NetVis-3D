import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const collectorRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 采集器状态存储（实际应使用Redis）
const collectors = new Map<string, {
  id: string;
  name: string;
  version: string;
  status: 'online' | 'offline';
  lastHeartbeat: Date;
  startedAt: Date;
  metricsCount: number;
}>();

// 设备指标存储 (已迁移至TimescaleDB)
// const metricsBuffer: Array<...> = [];


// 注册采集器
const registerSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  status: z.string(),
  startedAt: z.string(),
});

collectorRoutes.post('/register', zValidator('json', registerSchema), async (c) => {
  const data = c.req.valid('json');

  try {
    collectors.set(data.id, {
      id: data.id,
      name: data.name,
      version: data.version,
      status: 'online',
      lastHeartbeat: new Date(),
      startedAt: new Date(data.startedAt),
      metricsCount: 0,
    });

    // console.log(`Collector registered: ${data.id}`);

    return c.json({
      code: 0,
      message: '采集器注册成功',
      data: {
        id: data.id,
        config: {
          interval: 60,
          concurrency: 10,
        },
      },
    });
  } catch (error) {
    console.error('Register collector error:', error);
    return c.json({ code: 500, message: '注册采集器失败' }, 500);
  }
});

// 心跳接口
collectorRoutes.post('/heartbeat', zValidator('json', z.object({
  id: z.string(),
  status: z.string(),
  timestamp: z.string(),
})), async (c) => {
  const { id, status } = c.req.valid('json');

  try {
    const collector = collectors.get(id);
    if (collector) {
      collector.lastHeartbeat = new Date();
      collector.status = status === 'online' ? 'online' : 'offline';
    }

    return c.json({ code: 0, message: 'OK' });
  } catch (error) {
    return c.json({ code: 500, message: '心跳失败' }, 500);
  }
});

// 上报指标
const metricsSchema = z.object({
  collectorId: z.string(),
  timestamp: z.string(),
  metrics: z.array(z.object({
    deviceId: z.string(),
    ip: z.string(),
    status: z.string(),
    latency: z.number(),
    packetLoss: z.number().optional(),
    cpuUsage: z.number().optional(),
    memoryUsage: z.number().optional(),
    uptime: z.number().optional(),
    collectedAt: z.string(),
  })),
});

collectorRoutes.post('/metrics', zValidator('json', metricsSchema), async (c) => {
  const data = c.req.valid('json');

  try {
    const collector = collectors.get(data.collectorId);
    if (collector) {
      collector.metricsCount += data.metrics.length;
    }

    // 存储指标 (写入TimescaleDB)
    if (data.metrics.length > 0) {
      const metricsToInsert = data.metrics.map(m => ({
        deviceId: m.deviceId,
        collectorId: data.collectorId,
        status: m.status,
        latency: Math.round(m.latency), // integer in schema
        packetLoss: Math.round(m.packetLoss || 0),
        cpuUsage: Math.round(m.cpuUsage || 0),
        memoryUsage: Math.round(m.memoryUsage || 0),
        uptime: Math.round(m.uptime || 0),
        timestamp: new Date(m.collectedAt),
      }));

      await db.insert(schema.deviceMetrics).values(metricsToInsert);

      // 更新设备状态 (Optimization: Batch update or ensure simplified logic)
      // For now, simpler to iterate, or rely on another mechanism status sync
      for (const m of data.metrics) {
        try {
           await db.update(schema.devices)
            .set({ 
              status: m.status as 'online' | 'offline',
              updatedAt: new Date(),
            })
            .where(eq(schema.devices.id, m.deviceId));
        } catch(e) { /* ignore */ }
      }
    }

    return c.json({
      code: 0,
      message: `已接收并存储 ${data.metrics.length} 条指标`,
    });
  } catch (error) {
    console.error('Store metrics error:', error);
    return c.json({ code: 500, message: '存储指标失败' }, 500);
  }
});


// 获取采集器列表
collectorRoutes.get('/list', authMiddleware, requireRole('admin'), async (c) => {
  try {
    const list = Array.from(collectors.values());

    // 检查离线状态
    const now = Date.now();
    list.forEach(col => {
      if (now - col.lastHeartbeat.getTime() > 120000) { // 2分钟无心跳
        col.status = 'offline';
      }
    });

    return c.json({
      code: 0,
      data: list,
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取采集器列表失败' }, 500);
  }
});

// 获取设备列表（供采集器拉取）
collectorRoutes.get('/devices', async (c) => {
  try {
    const devices = await db.select({
      id: schema.devices.id,
      ip: schema.devices.ipAddress,
      type: schema.devices.type,
    }).from(schema.devices);

    return c.json({
      code: 0,
      data: devices.map(d => ({
        id: d.id,
        ip: d.ip || '',
        type: d.type,
        community: 'public', // 默认SNMP团体名
      })),
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取设备列表失败' }, 500);
  }
});

// 获取最近指标
collectorRoutes.get('/metrics/recent', authMiddleware, async (c) => {
  try {
    const deviceId = c.req.query('deviceId');
    const limit = parseInt(c.req.query('limit') || '100');

    let query = db.select()
      .from(schema.deviceMetrics)
      .orderBy(desc(schema.deviceMetrics.timestamp))
      .limit(limit);

    if (deviceId) {
      // @ts-ignore
      query = query.where(eq(schema.deviceMetrics.deviceId, deviceId));
    }

    const metrics = await query;

    return c.json({
      code: 0,
      data: metrics,
    });
  } catch (error) {
    console.error('Get recent metrics error:', error);
    return c.json({ code: 500, message: '获取指标失败' }, 500);
  }
});


// 上报拓扑数据
const topologySchema = z.object({
  collectorId: z.string(),
  deviceId: z.string(), // Local Device ID or IP
  ip: z.string(),
  neighbors: z.array(z.object({
    localPort: z.string(),
    remotePort: z.string(),
    remoteChassisId: z.string(),
    remoteSystemName: z.string(),
    remoteIp: z.string().optional(),
    linkType: z.string().default('ethernet'),
  })),
});

collectorRoutes.post('/topology', zValidator('json', topologySchema), async (c) => {
  const data = c.req.valid('json');
  
  // Dynamic import to avoid circular dependency issues if any
  const { TopologyService } = await import('../services/topology.service');

  try {
    const result = await TopologyService.processTopologyData({
      deviceId: data.deviceId,
      deviceIp: data.ip,
      neighbors: data.neighbors,
    });

    return c.json({
      code: 0,
      message: '拓扑数据处理成功',
      data: result,
    });
  } catch (error) {
    console.error('Process topology error:', error);
    return c.json({ code: 500, message: '处理拓扑数据失败' }, 500);
  }
});

export { collectorRoutes };

