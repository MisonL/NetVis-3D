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

// 获取设备接口流量
trafficRoutes.get('/interfaces/:deviceId', authMiddleware, async (c) => {
  const deviceId = c.req.param('deviceId');

  try {
    const [device] = await db.select().from(schema.devices).where(eq(schema.devices.id, deviceId));
    if (!device) {
      return c.json({ code: 404, message: '设备不存在' }, 404);
    }

    // 模拟接口列表
    const interfaces = [
      'GigabitEthernet0/0',
      'GigabitEthernet0/1',
      'GigabitEthernet0/2',
      'FastEthernet0/0',
      'Management0',
    ].map(name => generateInterfaceTraffic(deviceId, name));

    return c.json({
      code: 0,
      data: {
        deviceId,
        deviceName: device.name,
        interfaces,
        collectTime: new Date(),
      },
    });
  } catch (error) {
    console.error('Get interface traffic error:', error);
    return c.json({ code: 500, message: '获取接口流量失败' }, 500);
  }
});

// 获取流量概览
trafficRoutes.get('/overview', authMiddleware, async (c) => {
  try {
    const devices = await db.select().from(schema.devices);

    // 汇总统计
    const totalInBytes = Math.floor(Math.random() * 100000000000);
    const totalOutBytes = Math.floor(Math.random() * 80000000000);
    const avgUtilization = Math.floor(Math.random() * 60);

    // TOP5设备
    const topDevices = devices.slice(0, 5).map(d => ({
      deviceId: d.id,
      deviceName: d.name,
      inBytes: Math.floor(Math.random() * 10000000000),
      outBytes: Math.floor(Math.random() * 8000000000),
      utilization: Math.floor(Math.random() * 100),
    }));

    // TOP5接口
    const topInterfaces = [
      { deviceName: '核心交换机', interface: 'GigabitEthernet0/0', utilization: 92 },
      { deviceName: '汇聚交换机-A', interface: 'GigabitEthernet0/1', utilization: 85 },
      { deviceName: '边界路由器', interface: 'GigabitEthernet0/0', utilization: 78 },
      { deviceName: '核心交换机', interface: 'GigabitEthernet0/2', utilization: 72 },
      { deviceName: '接入交换机-1', interface: 'GigabitEthernet0/0', utilization: 68 },
    ];

    return c.json({
      code: 0,
      data: {
        summary: {
          totalDevices: devices.length,
          totalInBytes,
          totalOutBytes,
          avgUtilization,
          highUtilizationCount: Math.floor(devices.length * 0.1),
        },
        topDevices,
        topInterfaces,
        collectTime: new Date(),
      },
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取流量概览失败' }, 500);
  }
});

// 获取流量趋势
trafficRoutes.get('/trend', authMiddleware, async (c) => {
  const deviceId = c.req.query('deviceId');
  const interfaceName = c.req.query('interface');
  const hours = parseInt(c.req.query('hours') || '24');

  try {
    const now = Date.now();
    const data = [];

    for (let i = hours; i >= 0; i--) {
      const timestamp = new Date(now - i * 3600000);
      data.push({
        timestamp: timestamp.toISOString(),
        inBytes: Math.floor(Math.random() * 50000000),
        outBytes: Math.floor(Math.random() * 40000000),
        inBytesRate: Math.floor(Math.random() * 100000000),
        outBytesRate: Math.floor(Math.random() * 80000000),
        utilization: Math.floor(Math.random() * 100),
      });
    }

    return c.json({
      code: 0,
      data: {
        deviceId,
        interfaceName,
        hours,
        trend: data,
      },
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取流量趋势失败' }, 500);
  }
});

// 获取实时流量（用于大屏展示）
trafficRoutes.get('/realtime', authMiddleware, async (c) => {
  try {
    const devices = await db.select().from(schema.devices).limit(10);

    const realtimeData = devices.map(d => ({
      deviceId: d.id,
      deviceName: d.name,
      inRate: Math.floor(Math.random() * 1000000000),
      outRate: Math.floor(Math.random() * 800000000),
      utilization: Math.floor(Math.random() * 100),
      status: d.status,
    }));

    return c.json({
      code: 0,
      data: realtimeData,
      timestamp: new Date(),
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取实时流量失败' }, 500);
  }
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
