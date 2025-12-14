import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const baselineRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 性能基线存储
const performanceBaselines = new Map<string, {
  id: string;
  deviceId: string;
  metricType: string;
  avgValue: number;
  minValue: number;
  maxValue: number;
  stdDev: number;
  sampleCount: number;
  period: string;
  createdAt: Date;
  updatedAt: Date;
}>();

// 初始化模拟基线数据
const defaultMetrics = ['cpu', 'memory', 'disk', 'bandwidth', 'latency'];

// 获取设备基线
baselineRoutes.get('/device/:deviceId', authMiddleware, async (c) => {
  const deviceId = c.req.param('deviceId');

  try {
    const [device] = await db.select().from(schema.devices).where(eq(schema.devices.id, deviceId));
    if (!device) {
      return c.json({ code: 404, message: '设备不存在' }, 404);
    }

    // 生成模拟基线数据
    const baselines = defaultMetrics.map(metric => ({
      id: `${deviceId}-${metric}`,
      deviceId,
      metricType: metric,
      avgValue: Math.floor(Math.random() * 50) + 20,
      minValue: Math.floor(Math.random() * 20),
      maxValue: Math.floor(Math.random() * 30) + 70,
      stdDev: Math.random() * 10,
      sampleCount: Math.floor(Math.random() * 1000) + 500,
      period: '7d',
      createdAt: new Date(Date.now() - 7 * 24 * 3600000),
      updatedAt: new Date(),
    }));

    return c.json({
      code: 0,
      data: {
        deviceId,
        deviceName: device.name,
        baselines,
      },
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取基线失败' }, 500);
  }
});

// 获取基线概览
baselineRoutes.get('/overview', authMiddleware, async (c) => {
  try {
    const devices = await db.select().from(schema.devices).limit(20);

    const overview = {
      totalDevices: devices.length,
      devicesWithBaseline: Math.floor(devices.length * 0.8),
      metricsTracked: defaultMetrics.length,
      lastCalculated: new Date(),
      alerts: {
        aboveBaseline: Math.floor(Math.random() * 10),
        belowBaseline: Math.floor(Math.random() * 5),
      },
    };

    // 设备基线摘要
    const deviceSummaries = devices.slice(0, 10).map(d => ({
      deviceId: d.id,
      deviceName: d.name,
      status: d.status,
      hasBaseline: Math.random() > 0.2,
      deviations: Math.floor(Math.random() * 3),
      lastUpdated: new Date(Date.now() - Math.random() * 24 * 3600000),
    }));

    return c.json({
      code: 0,
      data: {
        overview,
        deviceSummaries,
      },
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取基线概览失败' }, 500);
  }
});

// 计算/更新基线
baselineRoutes.post('/calculate', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  deviceIds: z.array(z.string().uuid()).optional(),
  period: z.enum(['1d', '7d', '30d']).default('7d'),
})), async (c) => {
  const { deviceIds, period } = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    let devices;
    if (deviceIds && deviceIds.length > 0) {
      devices = await db.select().from(schema.devices);
      devices = devices.filter(d => deviceIds.includes(d.id));
    } else {
      devices = await db.select().from(schema.devices);
    }

    // 模拟计算基线
    let calculated = 0;
    for (const device of devices) {
      for (const metric of defaultMetrics) {
        const id = `${device.id}-${metric}`;
        performanceBaselines.set(id, {
          id,
          deviceId: device.id,
          metricType: metric,
          avgValue: Math.floor(Math.random() * 50) + 20,
          minValue: Math.floor(Math.random() * 20),
          maxValue: Math.floor(Math.random() * 30) + 70,
          stdDev: Math.random() * 10,
          sampleCount: Math.floor(Math.random() * 1000) + 500,
          period,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        calculated++;
      }
    }

    // 审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'calculate_baseline',
      resource: 'performance_baseline',
      details: JSON.stringify({ deviceCount: devices.length, period }),
    });

    return c.json({
      code: 0,
      message: `已计算 ${devices.length} 台设备的基线`,
      data: { devicesProcessed: devices.length, metricsCalculated: calculated },
    });
  } catch (error) {
    return c.json({ code: 500, message: '计算基线失败' }, 500);
  }
});

// 检测异常 - 与基线对比
baselineRoutes.get('/anomalies', authMiddleware, async (c) => {
  const threshold = parseFloat(c.req.query('threshold') || '2.0'); // 标准差倍数

  try {
    const devices = await db.select().from(schema.devices).limit(10);

    const anomalies = [];
    for (const device of devices) {
      for (const metric of defaultMetrics) {
        if (Math.random() > 0.7) { // 30%概率产生异常
          const baseline = 50;
          const current = baseline + (Math.random() > 0.5 ? 1 : -1) * threshold * 10 * (Math.random() + 0.5);
          
          anomalies.push({
            deviceId: device.id,
            deviceName: device.name,
            metricType: metric,
            currentValue: Math.round(current * 10) / 10,
            baselineAvg: baseline,
            deviation: Math.round((current - baseline) / 10 * 100) / 100,
            severity: Math.abs(current - baseline) > 30 ? 'critical' : 'warning',
            detectedAt: new Date(),
          });
        }
      }
    }

    return c.json({
      code: 0,
      data: {
        threshold,
        totalAnomalies: anomalies.length,
        anomalies: anomalies.slice(0, 20),
      },
    });
  } catch (error) {
    return c.json({ code: 500, message: '检测异常失败' }, 500);
  }
});

// 获取指标趋势与基线对比
baselineRoutes.get('/trend/:deviceId/:metric', authMiddleware, async (c) => {
  const deviceId = c.req.param('deviceId');
  const metric = c.req.param('metric');
  const hours = parseInt(c.req.query('hours') || '24');

  try {
    const baselineAvg = Math.floor(Math.random() * 30) + 40;
    const baselineStd = Math.random() * 10;

    const now = Date.now();
    const data = [];

    for (let i = hours; i >= 0; i--) {
      const timestamp = new Date(now - i * 3600000);
      const value = baselineAvg + (Math.random() - 0.5) * 40;
      
      data.push({
        timestamp: timestamp.toISOString(),
        value: Math.round(value * 10) / 10,
        baselineAvg,
        upperBound: Math.round((baselineAvg + 2 * baselineStd) * 10) / 10,
        lowerBound: Math.round((baselineAvg - 2 * baselineStd) * 10) / 10,
        isAnomaly: Math.abs(value - baselineAvg) > 2 * baselineStd,
      });
    }

    return c.json({
      code: 0,
      data: {
        deviceId,
        metric,
        baselineAvg,
        baselineStd,
        trend: data,
      },
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取趋势失败' }, 500);
  }
});

export { baselineRoutes };
