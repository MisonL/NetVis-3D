import { Hono } from 'hono';
import { db, schema } from '../db';
import { count, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const analyticsRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 获取仪表盘统计数据
analyticsRoutes.get('/dashboard', authMiddleware, async (c) => {
  try {
    // 设备统计
    const deviceCount = await db.select({ count: count() }).from(schema.devices);
    
    // 用户统计
    const userCount = await db.select({ count: count() }).from(schema.users);
    
    // 告警统计
    const alertCount = await db.select({ count: count() }).from(schema.alerts);
    
    // 按类型统计设备
    const devicesByType = await db
      .select({
        type: schema.devices.type,
        count: count(),
      })
      .from(schema.devices)
      .groupBy(schema.devices.type);
    
    // 按状态统计设备
    const devicesByStatus = await db
      .select({
        status: schema.devices.status,
        count: count(),
      })
      .from(schema.devices)
      .groupBy(schema.devices.status);
    
    // 按严重程度统计告警
    const alertsBySeverity = await db
      .select({
        severity: schema.alerts.severity,
        count: count(),
      })
      .from(schema.alerts)
      .groupBy(schema.alerts.severity);

    return c.json({
      code: 0,
      data: {
        summary: {
          totalDevices: deviceCount[0]?.count ?? 0,
          totalUsers: userCount[0]?.count ?? 0,
          totalAlerts: alertCount[0]?.count ?? 0,
        },
        devicesByType: devicesByType.map(d => ({
          type: d.type,
          count: Number(d.count),
        })),
        devicesByStatus: devicesByStatus.map(d => ({
          status: d.status,
          count: Number(d.count),
        })),
        alertsBySeverity: alertsBySeverity.map(a => ({
          severity: a.severity,
          count: Number(a.count),
        })),
      },
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    return c.json({ code: 500, message: '获取统计数据失败' }, 500);
  }
});

// 获取设备趋势数据（模拟）
analyticsRoutes.get('/trends/devices', authMiddleware, async (c) => {
  try {
    // 模拟过去7天的数据
    const now = new Date();
    const trends = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      trends.push({
        date: date.toISOString().split('T')[0],
        online: Math.floor(Math.random() * 50) + 80,
        offline: Math.floor(Math.random() * 10) + 5,
        warning: Math.floor(Math.random() * 5) + 2,
      });
    }

    return c.json({
      code: 0,
      data: trends,
    });
  } catch (error) {
    console.error('Get device trends error:', error);
    return c.json({ code: 500, message: '获取趋势数据失败' }, 500);
  }
});

// 获取告警趋势数据（模拟）
analyticsRoutes.get('/trends/alerts', authMiddleware, async (c) => {
  try {
    const now = new Date();
    const trends = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      trends.push({
        date: date.toISOString().split('T')[0],
        critical: Math.floor(Math.random() * 5),
        warning: Math.floor(Math.random() * 15) + 5,
        info: Math.floor(Math.random() * 20) + 10,
      });
    }

    return c.json({
      code: 0,
      data: trends,
    });
  } catch (error) {
    console.error('Get alert trends error:', error);
    return c.json({ code: 500, message: '获取趋势数据失败' }, 500);
  }
});

// 获取流量统计数据（模拟）
analyticsRoutes.get('/traffic', authMiddleware, async (c) => {
  try {
    const now = new Date();
    const data = [];
    
    // 过去24小时的流量数据
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now);
      hour.setHours(hour.getHours() - i);
      data.push({
        time: `${hour.getHours().toString().padStart(2, '0')}:00`,
        inbound: Math.floor(Math.random() * 500) + 200,
        outbound: Math.floor(Math.random() * 400) + 150,
      });
    }

    return c.json({
      code: 0,
      data: {
        hourly: data,
        summary: {
          totalInbound: data.reduce((sum, d) => sum + d.inbound, 0),
          totalOutbound: data.reduce((sum, d) => sum + d.outbound, 0),
          peakInbound: Math.max(...data.map(d => d.inbound)),
          peakOutbound: Math.max(...data.map(d => d.outbound)),
        },
      },
    });
  } catch (error) {
    console.error('Get traffic stats error:', error);
    return c.json({ code: 500, message: '获取流量数据失败' }, 500);
  }
});

// 获取TOP设备（按CPU/内存/流量）
analyticsRoutes.get('/top-devices', authMiddleware, async (c) => {
  try {
    // 模拟数据
    const topByCpu = [
      { name: 'Core-Router-01', value: 85, ip: '192.168.1.1' },
      { name: 'Firewall-Main', value: 78, ip: '192.168.1.2' },
      { name: 'Switch-DC-A', value: 72, ip: '192.168.1.3' },
      { name: 'Server-App-01', value: 68, ip: '192.168.1.10' },
      { name: 'Switch-Core', value: 65, ip: '192.168.1.4' },
    ];
    
    const topByMemory = [
      { name: 'Server-DB-01', value: 92, ip: '192.168.1.20' },
      { name: 'Server-App-01', value: 85, ip: '192.168.1.10' },
      { name: 'Core-Router-01', value: 75, ip: '192.168.1.1' },
      { name: 'Firewall-Main', value: 70, ip: '192.168.1.2' },
      { name: 'Server-Web-01', value: 65, ip: '192.168.1.11' },
    ];
    
    const topByTraffic = [
      { name: 'Core-Router-01', value: 8500, ip: '192.168.1.1' },
      { name: 'Switch-Core', value: 6200, ip: '192.168.1.4' },
      { name: 'Firewall-Main', value: 5800, ip: '192.168.1.2' },
      { name: 'Switch-DC-A', value: 4500, ip: '192.168.1.3' },
      { name: 'Server-Web-01', value: 3200, ip: '192.168.1.11' },
    ];

    return c.json({
      code: 0,
      data: {
        byCpu: topByCpu,
        byMemory: topByMemory,
        byTraffic: topByTraffic,
      },
    });
  } catch (error) {
    console.error('Get top devices error:', error);
    return c.json({ code: 500, message: '获取TOP设备失败' }, 500);
  }
});

export { analyticsRoutes };
