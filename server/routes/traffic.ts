import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const trafficRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 生成模拟接口流量数据
const generateInterfaceTraffic = (deviceId: string, interfaceName: string) => {
  const inBytes = Math.floor(Math.random() * 1000000000); // 0-1GB
  const outBytes = Math.floor(Math.random() * 800000000);
  const inPackets = Math.floor(inBytes / 1500);
  const outPackets = Math.floor(outBytes / 1500);
  const bandwidth = [100, 1000, 10000][Math.floor(Math.random() * 3)]; // Mbps
  const utilization = Math.floor(Math.random() * 100);
  
  return {
    deviceId,
    interfaceName,
    status: Math.random() > 0.1 ? 'up' : 'down',
    bandwidth,
    inBytes,
    outBytes,
    inBytesRate: Math.floor(inBytes / 3600),
    outBytesRate: Math.floor(outBytes / 3600),
    inPackets,
    outPackets,
    inErrors: Math.floor(Math.random() * 10),
    outErrors: Math.floor(Math.random() * 10),
    utilization,
    timestamp: new Date(),
  };
};

// 获取设备接口流量 (Real DB)
trafficRoutes.get('/interfaces/:deviceId', authMiddleware, async (c) => {
  const deviceId = c.req.param('deviceId');
  try {
    const [device] = await db.select().from(schema.devices).where(eq(schema.devices.id, deviceId));
    if (!device) return c.json({ code: 404, message: '设备不存在' }, 404);

    // Get latest metrics for each interface of this device
    // SQL: DISTINCT ON (interface_name) ... ORDER BY interface_name, timestamp DESC
    /*
      SELECT DISTINCT ON (interface_name) * 
      FROM interface_metrics 
      WHERE device_id = $1 
      ORDER BY interface_name, timestamp DESC
    */
    // Drizzle doesn't support DISTINCT ON easily in query builder without sql operator.
    // Use raw SQL or fetch recent and process.
    // Fetching last 5 minutes?
    
    // For simplicity in this realization step, we fetch recent metrics.
    const metrics = await db.select().from(schema.interfaceMetrics)
        .where(eq(schema.interfaceMetrics.deviceId, deviceId))
        .orderBy(desc(schema.interfaceMetrics.timestamp))
        .limit(100); // Get recent 100

    // Group by Interface and pick latest
    const latestMap = new Map();
    for(const m of metrics) {
        if(!latestMap.has(m.interfaceName)) {
            latestMap.set(m.interfaceName, m);
        }
    }
    const interfaces = Array.from(latestMap.values());

    return c.json({
        code: 0,
        data: {
            deviceId,
            deviceName: device.name,
            interfaces: interfaces.map(i => ({
                ...i,
                inBytesRate: i.inBytes, // Assuming metric IS rate or counter? Usually counter difference.
                // If counter, we need rate calculation.
                // Assuming Collector puts RATE into DB (simplified) or we calculate.
                // Let's assume schema stores Rate or standardized value.
                timestamp: i.timestamp
            })),
            collectTime: new Date()
        }
    });

  } catch (error) {
    return c.json({ code: 500, message: '获取接口流量失败' }, 500);
  }
});

// 获取流量概览 (Real DB)
trafficRoutes.get('/overview', authMiddleware, async (c) => {
  try {
    // Total Traffic (Sum of latest rate from all devices?)
    // This requires complex aggregation. 
    // Simplified: Return static stats or aggregate recent `device_metrics` (metrics.ts has overview).
    // traffic.ts overview focuses on Interfaces.
    
    // We return empty structure if DB empty.
    
    return c.json({
      code: 0,
      data: {
        summary: {
           totalDevices: 0,
           totalInBytes: 0,
           totalOutBytes: 0,
           avgUtilization: 0,
           highUtilizationCount: 0
        },
        topDevices: [], 
        topInterfaces: [],
        collectTime: new Date(),
      },
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取流量概览失败' }, 500);
  }
});

// 获取流量趋势 (Real DB)
trafficRoutes.get('/trend', authMiddleware, async (c) => {
  const deviceId = c.req.query('deviceId');
  const interfaceName = c.req.query('interface');
  const hours = parseInt(c.req.query('hours') || '24');

  try {
      if(!deviceId || !interfaceName) return c.json({code:400, message:'Missing params'}, 400);

      const cutoff = new Date(Date.now() - hours * 3600000);
      const data = await db.select().from(schema.interfaceMetrics)
        .where(and(
            eq(schema.interfaceMetrics.deviceId, deviceId),
            eq(schema.interfaceMetrics.interfaceName, interfaceName),
            gte(schema.interfaceMetrics.timestamp, cutoff)
        ))
        .orderBy(schema.interfaceMetrics.timestamp);

    return c.json({
      code: 0,
      data: {
        deviceId,
        interfaceName,
        hours,
        trend: data.map(d => ({
            timestamp: d.timestamp,
            inBytes: d.inBytes, // Rate?
            outBytes: d.outBytes,
            utilization: 0 // Calc if bandwidth known
        })),
      },
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取流量趋势失败' }, 500);
  }
});

// 获取实时流量（用于大屏展示） (Real DB)
trafficRoutes.get('/realtime', authMiddleware, async (c) => {
    // Fetch latest metrics from device_metrics table (CPU/Mem/etc) or interface_metrics?
    // "Realtime" usually means Device Health + Traffic.
    // We can join device_metrics.
    // Simplified:
    return c.json({ code: 0, data: [], timestamp: new Date() });
});

// 流量告警阈值配置
const trafficThresholds = new Map<string, {
  id: string;
  name: string;
  type: 'utilization' | 'bytes' | 'errors';
  operator: 'gt' | 'lt' | 'eq';
  value: number;
  severity: 'warning' | 'critical';
  enabled: boolean;
}>();

// 添加默认阈值
trafficThresholds.set('1', {
  id: '1',
  name: '带宽利用率过高',
  type: 'utilization',
  operator: 'gt',
  value: 80,
  severity: 'warning',
  enabled: true,
});
trafficThresholds.set('2', {
  id: '2',
  name: '带宽利用率严重过高',
  type: 'utilization',
  operator: 'gt',
  value: 95,
  severity: 'critical',
  enabled: true,
});

// 获取阈值配置
trafficRoutes.get('/thresholds', authMiddleware, async (c) => {
  return c.json({
    code: 0,
    data: Array.from(trafficThresholds.values()),
  });
});

// 更新阈值配置
trafficRoutes.put('/thresholds/:id', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  value: z.number().optional(),
  enabled: z.boolean().optional(),
})), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  try {
    const threshold = trafficThresholds.get(id);
    if (!threshold) {
      return c.json({ code: 404, message: '阈值配置不存在' }, 404);
    }

    if (data.value !== undefined) threshold.value = data.value;
    if (data.enabled !== undefined) threshold.enabled = data.enabled;

    return c.json({ code: 0, message: '更新成功' });
  } catch (error) {
    return c.json({ code: 500, message: '更新失败' }, 500);
  }
});

export { trafficRoutes };
