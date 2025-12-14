import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc, and, or, count } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const topologyRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 连接关系存储（实际应使用数据库）
const connections = new Map<string, {
  id: string;
  sourceId: string;
  targetId: string;
  sourcePort?: string;
  targetPort?: string;
  linkType: 'ethernet' | 'fiber' | 'wireless' | 'virtual';
  bandwidth?: number;
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  utilization?: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}>();

// 连接Schema
const connectionSchema = z.object({
  sourceId: z.string().uuid('无效的源设备ID'),
  targetId: z.string().uuid('无效的目标设备ID'),
  sourcePort: z.string().optional(),
  targetPort: z.string().optional(),
  linkType: z.enum(['ethernet', 'fiber', 'wireless', 'virtual']),
  bandwidth: z.number().positive().optional(),
  description: z.string().optional(),
});

// 获取所有连接
topologyRoutes.get('/connections', authMiddleware, async (c) => {
  const deviceId = c.req.query('deviceId');

  try {
    let result = Array.from(connections.values());

    if (deviceId) {
      result = result.filter(conn => 
        conn.sourceId === deviceId || conn.targetId === deviceId
      );
    }

    // 获取设备信息
    const devices = await db.select().from(schema.devices);
    const deviceMap = new Map(devices.map(d => [d.id, d]));

    const enrichedConnections = result.map(conn => ({
      ...conn,
      source: deviceMap.get(conn.sourceId) || { id: conn.sourceId, name: 'Unknown' },
      target: deviceMap.get(conn.targetId) || { id: conn.targetId, name: 'Unknown' },
    }));

    return c.json({
      code: 0,
      data: enrichedConnections,
    });
  } catch (error) {
    console.error('Get connections error:', error);
    return c.json({ code: 500, message: '获取连接失败' }, 500);
  }
});

// 获取拓扑图数据（节点和边）
topologyRoutes.get('/graph', authMiddleware, async (c) => {
  try {
    const devices = await db.select().from(schema.devices);
    const allConnections = Array.from(connections.values());

    const nodes = devices.map(device => ({
      id: device.id,
      name: device.name,
      type: device.type,
      status: device.status,
      ip: device.ipAddress,
      group: device.groupId,
    }));

    const edges = allConnections.map(conn => ({
      id: conn.id,
      source: conn.sourceId,
      target: conn.targetId,
      linkType: conn.linkType,
      status: conn.status,
      bandwidth: conn.bandwidth,
      utilization: conn.utilization,
    }));

    return c.json({
      code: 0,
      data: {
        nodes,
        edges,
        stats: {
          nodeCount: nodes.length,
          edgeCount: edges.length,
          onlineNodes: nodes.filter(n => n.status === 'online').length,
          upLinks: edges.filter(e => e.status === 'up').length,
        },
      },
    });
  } catch (error) {
    console.error('Get graph error:', error);
    return c.json({ code: 500, message: '获取拓扑图失败' }, 500);
  }
});

// 创建连接
topologyRoutes.post('/connections', authMiddleware, requireRole('admin'), zValidator('json', connectionSchema), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    // 验证设备存在
    const [source] = await db.select().from(schema.devices).where(eq(schema.devices.id, data.sourceId));
    const [target] = await db.select().from(schema.devices).where(eq(schema.devices.id, data.targetId));

    if (!source || !target) {
      return c.json({ code: 400, message: '源设备或目标设备不存在' }, 400);
    }

    const id = crypto.randomUUID();
    
    const connection = {
      id,
      sourceId: data.sourceId,
      targetId: data.targetId,
      sourcePort: data.sourcePort,
      targetPort: data.targetPort,
      linkType: data.linkType,
      bandwidth: data.bandwidth,
      status: 'up' as const,
      latency: Math.random() * 10 + 1,
      utilization: Math.random() * 50,
      description: data.description,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    connections.set(id, connection);

    // 审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'create',
      resource: 'topology_connections',
      resourceId: id,
      details: JSON.stringify({ source: source.name, target: target.name }),
    });

    return c.json({
      code: 0,
      message: '连接创建成功',
      data: connection,
    });
  } catch (error) {
    console.error('Create connection error:', error);
    return c.json({ code: 500, message: '创建连接失败' }, 500);
  }
});

// 更新连接
topologyRoutes.put('/connections/:id', authMiddleware, requireRole('admin'), zValidator('json', connectionSchema.partial()), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  try {
    const conn = connections.get(id);
    if (!conn) {
      return c.json({ code: 404, message: '连接不存在' }, 404);
    }

    if (data.sourcePort !== undefined) conn.sourcePort = data.sourcePort;
    if (data.targetPort !== undefined) conn.targetPort = data.targetPort;
    if (data.linkType) conn.linkType = data.linkType;
    if (data.bandwidth !== undefined) conn.bandwidth = data.bandwidth;
    if (data.description !== undefined) conn.description = data.description;
    conn.updatedAt = new Date();

    return c.json({ code: 0, message: '连接更新成功' });
  } catch (error) {
    console.error('Update connection error:', error);
    return c.json({ code: 500, message: '更新连接失败' }, 500);
  }
});

// 删除连接
topologyRoutes.delete('/connections/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const currentUser = c.get('user');

  try {
    const conn = connections.get(id);
    if (!conn) {
      return c.json({ code: 404, message: '连接不存在' }, 404);
    }

    connections.delete(id);

    // 审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'delete',
      resource: 'topology_connections',
      resourceId: id,
    });

    return c.json({ code: 0, message: '连接删除成功' });
  } catch (error) {
    console.error('Delete connection error:', error);
    return c.json({ code: 500, message: '删除连接失败' }, 500);
  }
});

// 获取连接统计
topologyRoutes.get('/stats', authMiddleware, async (c) => {
  try {
    const allConnections = Array.from(connections.values());

    const byType = {
      ethernet: allConnections.filter(c => c.linkType === 'ethernet').length,
      fiber: allConnections.filter(c => c.linkType === 'fiber').length,
      wireless: allConnections.filter(c => c.linkType === 'wireless').length,
      virtual: allConnections.filter(c => c.linkType === 'virtual').length,
    };

    const byStatus = {
      up: allConnections.filter(c => c.status === 'up').length,
      down: allConnections.filter(c => c.status === 'down').length,
      degraded: allConnections.filter(c => c.status === 'degraded').length,
    };

    return c.json({
      code: 0,
      data: {
        total: allConnections.length,
        byType,
        byStatus,
        avgUtilization: allConnections.length ? 
          allConnections.reduce((sum, c) => sum + (c.utilization || 0), 0) / allConnections.length : 0,
      },
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取统计失败' }, 500);
  }
});

// 自动发现连接（模拟）
topologyRoutes.post('/discover', authMiddleware, requireRole('admin'), async (c) => {
  const currentUser = c.get('user');

  try {
    const devices = await db.select().from(schema.devices);
    let created = 0;

    // 模拟发现连接：为部分设备创建随机连接
    for (let i = 0; i < Math.min(devices.length - 1, 10); i++) {
      const source = devices[i];
      const targetIndex = Math.floor(Math.random() * (devices.length - i - 1)) + i + 1;
      const target = devices[targetIndex];

      if (source && target) {
        const id = crypto.randomUUID();
        connections.set(id, {
          id,
          sourceId: source.id,
          targetId: target.id,
          linkType: ['ethernet', 'fiber', 'wireless'][Math.floor(Math.random() * 3)] as 'ethernet' | 'fiber' | 'wireless',
          status: Math.random() > 0.1 ? 'up' : 'down',
          bandwidth: [100, 1000, 10000][Math.floor(Math.random() * 3)],
          latency: Math.random() * 20,
          utilization: Math.random() * 80,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        created++;
      }
    }

    // 审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'discover',
      resource: 'topology_connections',
      details: JSON.stringify({ created }),
    });

    return c.json({
      code: 0,
      message: `发现并创建了 ${created} 条连接`,
    });
  } catch (error) {
    console.error('Discover connections error:', error);
    return c.json({ code: 500, message: '连接发现失败' }, 500);
  }
});

export { topologyRoutes };
