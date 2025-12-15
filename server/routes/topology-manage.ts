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
// 连接Schema (保持不变)

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
// 获取所有连接
topologyRoutes.get('/connections', authMiddleware, async (c) => {
  const deviceId = c.req.query('deviceId');

  try {
    let query = db.select().from(schema.topologyLinks);
    
    if (deviceId) {
      // @ts-ignore
      query = query.where(or(
        eq(schema.topologyLinks.sourceId, deviceId),
        eq(schema.topologyLinks.targetId, deviceId)
      ));
    }

    const result = await query;

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
// 获取拓扑图数据（节点和边）
topologyRoutes.get('/graph', authMiddleware, async (c) => {
  try {
    const devices = await db.select().from(schema.devices);
    const allConnections = await db.select().from(schema.topologyLinks);

    const nodes = devices.map(device => ({
      id: device.id,
      name: device.name,
      type: device.type,
      status: device.status,
      ip: device.ipAddress,
      group: device.groupId,
    }));

    // 动态判断链路逻辑：如果两端设备有一个Offline，链路视为Down?
    // 或者直接使用DB中的链路状态。
    // 为了"高级分析真实化"，我们在这里可以做简单的状态联动：
    const edges = allConnections.map(conn => {
        const sourceDev = devices.find(d => d.id === conn.sourceId);
        const targetDev = devices.find(d => d.id === conn.targetId);
        
        let dynamicStatus = conn.status;
        if (sourceDev?.status === 'offline' || targetDev?.status === 'offline') {
            dynamicStatus = 'down';
        }

        return {
          id: conn.id,
          source: conn.sourceId,
          target: conn.targetId,
          linkType: conn.linkType,
          status: dynamicStatus,
          bandwidth: conn.bandwidth,
          // utilization 暂无真实数据源，沿用null或DB值（如果DB有）
          // DB schema没有utilization列。
          utilization: 0, // Placeholder
        };
    });

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
 
    const [connection] = await db.insert(schema.topologyLinks).values({
      sourceId: data.sourceId,
      targetId: data.targetId,
      sourcePort: data.sourcePort,
      targetPort: data.targetPort,
      linkType: data.linkType,
      bandwidth: data.bandwidth,
      status: 'up',
      utilization: 0,
      description: data.description,
    }).returning();

    // 审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'create',
      resource: 'topology_connections',
      resourceId: connection.id,
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
// 更新连接
topologyRoutes.put('/connections/:id', authMiddleware, requireRole('admin'), zValidator('json', connectionSchema.partial()), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  try {
    const [updated] = await db.update(schema.topologyLinks)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schema.topologyLinks.id, id))
      .returning();

    if (!updated) {
      return c.json({ code: 404, message: '连接不存在' }, 404);
    }

    return c.json({ code: 0, message: '连接更新成功' });
  } catch (error) {
    console.error('Update connection error:', error);
    return c.json({ code: 500, message: '更新连接失败' }, 500);
  }
});

// 删除连接
// 删除连接
topologyRoutes.delete('/connections/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const currentUser = c.get('user');

  try {
    const [deleted] = await db.delete(schema.topologyLinks)
      .where(eq(schema.topologyLinks.id, id))
      .returning();

    if (!deleted) {
      return c.json({ code: 404, message: '连接不存在' }, 404);
    }

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
// 获取连接统计
topologyRoutes.get('/stats', authMiddleware, async (c) => {
  try {
    const allConnections = await db.select().from(schema.topologyLinks); // 或者使用聚合 count()

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
// 自动发现连接（生成演示数据并持久化）
topologyRoutes.post('/discover', authMiddleware, requireRole('admin'), async (c) => {
  const currentUser = c.get('user');

  try {
    const devices = await db.select().from(schema.devices);
    let created = 0;

    // 清除旧连接？可选。这里做增量。
    
    // 简单逻辑：如果设备尚无连接，随机连接到现有设备
    for (let i = 0; i < Math.min(devices.length - 1, 10); i++) {
        const source = devices[i];
        // 50% 概率创建
        if(Math.random() > 0.5) continue;

        const targetIndex = Math.floor(Math.random() * (devices.length - i - 1)) + i + 1;
        const target = devices[targetIndex];

        if (source && target) {
            // 检查是否已存在
            const existing = await db.select().from(schema.topologyLinks)
                .where(and(
                    eq(schema.topologyLinks.sourceId, source.id),
                    eq(schema.topologyLinks.targetId, target.id)
                ));
            
            if (existing.length === 0) {
                await db.insert(schema.topologyLinks).values({
                    sourceId: source.id,
                    targetId: target.id,
                    linkType: ['ethernet', 'fiber', 'wireless'][Math.floor(Math.random() * 3)] as any,
                    status: 'up',
                    bandwidth: [100, 1000, 10000][Math.floor(Math.random() * 3)],
                    utilization: Math.floor(Math.random() * 80),
                });
                created++;
            }
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
