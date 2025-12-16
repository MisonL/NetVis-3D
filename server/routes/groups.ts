import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc, inArray, count } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const groupRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 设备分组存储（实际应使用数据库）
const deviceGroups = new Map<string, {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  color?: string;
  icon?: string;
  deviceCount: number;
  createdAt: Date;
  updatedAt: Date;
}>();

// 初始化默认分组
const defaultGroups = [
  { id: '1', name: '核心层', description: '核心交换设备', color: '#1890ff', icon: 'cluster' },
  { id: '2', name: '汇聚层', description: '汇聚交换设备', color: '#52c41a', icon: 'apartment' },
  { id: '3', name: '接入层', description: '接入交换设备', color: '#faad14', icon: 'deployment-unit' },
  { id: '4', name: '服务器', description: '服务器设备', color: '#722ed1', icon: 'database' },
  { id: '5', name: '安全设备', description: '防火墙、IPS等', color: '#eb2f96', icon: 'safety' },
];

defaultGroups.forEach(g => {
  deviceGroups.set(g.id, {
    ...g,
    deviceCount: 0, // 将由实际数据库查询更新
    createdAt: new Date(),
    updatedAt: new Date(),
  });
});

// 分组Schema
const groupSchema = z.object({
  name: z.string().min(1, '分组名称不能为空'),
  description: z.string().optional(),
  parentId: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

// 获取分组列表
groupRoutes.get('/list', authMiddleware, async (c) => {
  try {
    const groups = Array.from(deviceGroups.values())
      .sort((a, b) => a.name.localeCompare(b.name));

    // 构建树形结构
    const buildTree = (parentId?: string): typeof groups => {
      return groups
        .filter(g => g.parentId === parentId)
        .map(g => ({
          ...g,
          children: buildTree(g.id),
        }));
    };

    const tree = buildTree(undefined);

    return c.json({
      code: 0,
      data: {
        list: groups,
        tree,
      },
    });
  } catch (error) {
    console.error('Get groups error:', error);
    return c.json({ code: 500, message: '获取分组列表失败' }, 500);
  }
});

// 获取单个分组
groupRoutes.get('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  
  try {
    const group = deviceGroups.get(id);
    if (!group) {
      return c.json({ code: 404, message: '分组不存在' }, 404);
    }

    // 获取分组内设备
    const devices = await db
      .select()
      .from(schema.devices)
      .where(eq(schema.devices.groupId, id));

    return c.json({
      code: 0,
      data: {
        ...group,
        devices,
      },
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取分组失败' }, 500);
  }
});

// 创建分组
groupRoutes.post('/', authMiddleware, requireRole('admin'), zValidator('json', groupSchema), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const id = crypto.randomUUID();
    
    const group = {
      id,
      name: data.name,
      description: data.description,
      parentId: data.parentId,
      color: data.color || '#1890ff',
      icon: data.icon || 'folder',
      deviceCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    deviceGroups.set(id, group);

    // 审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'create',
      resource: 'device_groups',
      resourceId: id,
      details: JSON.stringify({ name: data.name }),
    });

    return c.json({
      code: 0,
      message: '分组创建成功',
      data: group,
    });
  } catch (error) {
    console.error('Create group error:', error);
    return c.json({ code: 500, message: '创建分组失败' }, 500);
  }
});

// 更新分组
groupRoutes.put('/:id', authMiddleware, requireRole('admin'), zValidator('json', groupSchema.partial()), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  try {
    const group = deviceGroups.get(id);
    if (!group) {
      return c.json({ code: 404, message: '分组不存在' }, 404);
    }

    if (data.name) group.name = data.name;
    if (data.description !== undefined) group.description = data.description;
    if (data.parentId !== undefined) group.parentId = data.parentId;
    if (data.color) group.color = data.color;
    if (data.icon) group.icon = data.icon;
    group.updatedAt = new Date();

    return c.json({ code: 0, message: '分组更新成功' });
  } catch (error) {
    console.error('Update group error:', error);
    return c.json({ code: 500, message: '更新分组失败' }, 500);
  }
});

// 删除分组
groupRoutes.delete('/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const currentUser = c.get('user');

  try {
    const group = deviceGroups.get(id);
    if (!group) {
      return c.json({ code: 404, message: '分组不存在' }, 404);
    }

    // 检查是否有子分组
    const hasChildren = Array.from(deviceGroups.values()).some(g => g.parentId === id);
    if (hasChildren) {
      return c.json({ code: 400, message: '请先删除子分组' }, 400);
    }

    // 将分组内设备的groupId清空
    await db.update(schema.devices)
      .set({ groupId: null })
      .where(eq(schema.devices.groupId, id));

    deviceGroups.delete(id);

    // 审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'delete',
      resource: 'device_groups',
      resourceId: id,
    });

    return c.json({ code: 0, message: '分组删除成功' });
  } catch (error) {
    console.error('Delete group error:', error);
    return c.json({ code: 500, message: '删除分组失败' }, 500);
  }
});

// 批量移动设备到分组
groupRoutes.post('/:id/devices', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  deviceIds: z.array(z.string().uuid()),
})), async (c) => {
  const groupId = c.req.param('id');
  const { deviceIds } = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const group = deviceGroups.get(groupId);
    if (!group) {
      return c.json({ code: 404, message: '分组不存在' }, 404);
    }

    // 更新设备分组
    await db.update(schema.devices)
      .set({ groupId })
      .where(inArray(schema.devices.id, deviceIds));

    // 更新分组设备数
    group.deviceCount = (await db
      .select({ count: count() })
      .from(schema.devices)
      .where(eq(schema.devices.groupId, groupId)))[0]?.count || 0;

    // 审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'update',
      resource: 'device_groups',
      resourceId: groupId,
      details: JSON.stringify({ action: 'add_devices', deviceIds }),
    });

    return c.json({
      code: 0,
      message: `已将 ${deviceIds.length} 个设备移动到分组`,
    });
  } catch (error) {
    console.error('Move devices to group error:', error);
    return c.json({ code: 500, message: '移动设备失败' }, 500);
  }
});

// 从分组移除设备
groupRoutes.delete('/:id/devices', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  deviceIds: z.array(z.string().uuid()),
})), async (c) => {
  const groupId = c.req.param('id');
  const { deviceIds } = c.req.valid('json');

  try {
    const group = deviceGroups.get(groupId);
    if (!group) {
      return c.json({ code: 404, message: '分组不存在' }, 404);
    }

    await db.update(schema.devices)
      .set({ groupId: null })
      .where(inArray(schema.devices.id, deviceIds));

    group.deviceCount = Math.max(0, group.deviceCount - deviceIds.length);

    return c.json({
      code: 0,
      message: `已从分组移除 ${deviceIds.length} 个设备`,
    });
  } catch (error) {
    console.error('Remove devices from group error:', error);
    return c.json({ code: 500, message: '移除设备失败' }, 500);
  }
});

// 获取分组统计
groupRoutes.get('/stats/overview', authMiddleware, async (c) => {
  try {
    const groups = Array.from(deviceGroups.values());
    const totalDevices = groups.reduce((sum, g) => sum + g.deviceCount, 0);

    return c.json({
      code: 0,
      data: {
        totalGroups: groups.length,
        totalDevices,
        byGroup: groups.map(g => ({
          id: g.id,
          name: g.name,
          color: g.color,
          deviceCount: g.deviceCount,
        })),
      },
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取统计失败' }, 500);
  }
});

export { groupRoutes };
