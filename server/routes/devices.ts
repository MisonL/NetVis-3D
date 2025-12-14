import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc, count } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';
import { beforeAddDevice } from '../middleware/license';

const deviceRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 设备查询参数
const listQuerySchema = z.object({
  page: z.string().optional().transform(v => parseInt(v || '1')),
  pageSize: z.string().optional().transform(v => parseInt(v || '20')),
  keyword: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  vendor: z.string().optional(),
  groupId: z.string().optional(),
});

// 设备创建/更新
const deviceBodySchema = z.object({
  name: z.string().min(1, '设备名称不能为空'),
  label: z.string().optional(),
  type: z.enum(['router', 'switch', 'firewall', 'server', 'ap', 'other']),
  vendor: z.string().optional(),
  model: z.string().optional(),
  ipAddress: z.string().optional(),
  macAddress: z.string().optional(),
  location: z.string().optional(),
  groupId: z.string().uuid().optional(),
  status: z.enum(['online', 'offline', 'warning', 'error', 'unknown']).optional(),
});

// 获取设备列表
deviceRoutes.get('/', authMiddleware, zValidator('query', listQuerySchema), async (c) => {
  const { page, pageSize } = c.req.valid('query');
  const offset = (page - 1) * pageSize;

  try {
    const devices = await db
      .select()
      .from(schema.devices)
      .orderBy(desc(schema.devices.createdAt))
      .limit(pageSize)
      .offset(offset);

    const totalResult = await db.select({ total: count() }).from(schema.devices);
    const total = totalResult[0]?.total ?? 0;

    return c.json({
      code: 0,
      data: {
        list: devices,
        total,
        page,
        pageSize,
      },
    });
  } catch (error) {
    console.error('Get devices error:', error);
    return c.json({ code: 500, message: '获取设备列表失败' }, 500);
  }
});

// 获取单个设备
deviceRoutes.get('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');

  try {
    const [device] = await db
      .select()
      .from(schema.devices)
      .where(eq(schema.devices.id, id))
      .limit(1);

    if (!device) {
      return c.json({ code: 404, message: '设备不存在' }, 404);
    }

    return c.json({ code: 0, data: device });
  } catch (error) {
    console.error('Get device error:', error);
    return c.json({ code: 500, message: '获取设备信息失败' }, 500);
  }
});

// 创建设备
deviceRoutes.post('/', authMiddleware, requireRole('admin', 'user'), zValidator('json', deviceBodySchema), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    // License点数检查
    const licenseCheck = await beforeAddDevice();
    if (!licenseCheck.allowed) {
      return c.json({ 
        code: 403, 
        message: licenseCheck.message,
        data: { upgradeUrl: '/settings/license' }
      }, 403);
    }

    const result = await db
      .insert(schema.devices)
      .values({
        name: data.name,
        label: data.label || data.name,
        type: data.type,
        vendor: data.vendor,
        model: data.model,
        ipAddress: data.ipAddress,
        macAddress: data.macAddress,
        location: data.location,
        groupId: data.groupId,
        status: data.status || 'unknown',
      })
      .returning();

    const newDevice = result[0];
    if (!newDevice) {
      return c.json({ code: 500, message: '创建设备失败' }, 500);
    }

    // 记录审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'create',
      resource: 'devices',
      resourceId: newDevice.id,
      details: JSON.stringify({ name: newDevice.name, type: newDevice.type }),
    });

    return c.json({
      code: 0,
      message: '设备创建成功',
      data: newDevice,
    });
  } catch (error) {
    console.error('Create device error:', error);
    return c.json({ code: 500, message: '创建设备失败' }, 500);
  }
});

// 更新设备
deviceRoutes.put('/:id', authMiddleware, requireRole('admin', 'user'), zValidator('json', deviceBodySchema.partial()), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const [existing] = await db
      .select()
      .from(schema.devices)
      .where(eq(schema.devices.id, id))
      .limit(1);

    if (!existing) {
      return c.json({ code: 404, message: '设备不存在' }, 404);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.label !== undefined) updateData.label = data.label;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.vendor !== undefined) updateData.vendor = data.vendor;
    if (data.model !== undefined) updateData.model = data.model;
    if (data.ipAddress !== undefined) updateData.ipAddress = data.ipAddress;
    if (data.macAddress !== undefined) updateData.macAddress = data.macAddress;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.groupId !== undefined) updateData.groupId = data.groupId;
    if (data.status !== undefined) updateData.status = data.status;

    await db
      .update(schema.devices)
      .set(updateData)
      .where(eq(schema.devices.id, id));

    // 记录审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'update',
      resource: 'devices',
      resourceId: id,
      details: JSON.stringify({ fields: Object.keys(updateData) }),
    });

    return c.json({ code: 0, message: '更新成功' });
  } catch (error) {
    console.error('Update device error:', error);
    return c.json({ code: 500, message: '更新设备失败' }, 500);
  }
});

// 删除设备
deviceRoutes.delete('/:id', authMiddleware, requireRole('admin', 'user'), async (c) => {
  const id = c.req.param('id');
  const currentUser = c.get('user');

  try {
    const [existing] = await db
      .select()
      .from(schema.devices)
      .where(eq(schema.devices.id, id))
      .limit(1);

    if (!existing) {
      return c.json({ code: 404, message: '设备不存在' }, 404);
    }

    await db.delete(schema.devices).where(eq(schema.devices.id, id));

    // 记录审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'delete',
      resource: 'devices',
      resourceId: id,
      details: JSON.stringify({ name: existing.name }),
    });

    return c.json({ code: 0, message: '删除成功' });
  } catch (error) {
    console.error('Delete device error:', error);
    return c.json({ code: 500, message: '删除设备失败' }, 500);
  }
});

// 批量删除
deviceRoutes.delete('/batch', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  ids: z.array(z.string().uuid()),
})), async (c) => {
  const { ids } = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    for (const id of ids) {
      await db.delete(schema.devices).where(eq(schema.devices.id, id));
    }

    // 记录审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'delete',
      resource: 'devices',
      details: JSON.stringify({ count: ids.length, ids }),
    });

    return c.json({ code: 0, message: `成功删除 ${ids.length} 个设备` });
  } catch (error) {
    console.error('Batch delete error:', error);
    return c.json({ code: 500, message: '批量删除失败' }, 500);
  }
});

// 批量更新状态
const batchUpdateStatusSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, '请选择至少一个设备'),
  status: z.enum(['online', 'offline', 'warning', 'error', 'unknown']),
});

deviceRoutes.post('/batch/status', authMiddleware, requireRole('admin'), zValidator('json', batchUpdateStatusSchema), async (c) => {
  const { ids, status } = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    for (const id of ids) {
      await db.update(schema.devices)
        .set({ status, updatedAt: new Date() })
        .where(eq(schema.devices.id, id));
    }

    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'update',
      resource: 'devices',
      details: JSON.stringify({ action: 'batch_status', status, count: ids.length }),
    });

    return c.json({ code: 0, message: `成功更新 ${ids.length} 个设备状态` });
  } catch (error) {
    console.error('Batch update status error:', error);
    return c.json({ code: 500, message: '批量更新状态失败' }, 500);
  }
});

// 批量分配分组
const batchAssignGroupSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, '请选择至少一个设备'),
  groupId: z.string().uuid().nullable(),
});

deviceRoutes.post('/batch/group', authMiddleware, requireRole('admin'), zValidator('json', batchAssignGroupSchema), async (c) => {
  const { ids, groupId } = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    for (const id of ids) {
      await db.update(schema.devices)
        .set({ groupId, updatedAt: new Date() })
        .where(eq(schema.devices.id, id));
    }

    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'update',
      resource: 'devices',
      details: JSON.stringify({ action: 'batch_group', groupId, count: ids.length }),
    });

    return c.json({ code: 0, message: `成功分配 ${ids.length} 个设备到指定分组` });
  } catch (error) {
    console.error('Batch assign group error:', error);
    return c.json({ code: 500, message: '批量分配分组失败' }, 500);
  }
});

// 批量导出设备信息
deviceRoutes.post('/batch/export', authMiddleware, zValidator('json', z.object({
  ids: z.array(z.string().uuid()).optional(),
  format: z.enum(['json', 'csv']).default('json'),
})), async (c) => {
  const { ids, format } = c.req.valid('json');

  try {
    let devices;
    if (ids && ids.length > 0) {
      // 导出指定设备
      const results = [];
      for (const id of ids) {
        const [device] = await db.select().from(schema.devices).where(eq(schema.devices.id, id));
        if (device) results.push(device);
      }
      devices = results;
    } else {
      // 导出全部
      devices = await db.select().from(schema.devices);
    }

    if (format === 'csv') {
      const headers = ['名称', '类型', '厂商', '型号', 'IP地址', 'MAC地址', '状态', '位置'];
      const rows = devices.map(d => 
        [d.name, d.type, d.vendor || '', d.model || '', d.ipAddress || '', d.macAddress || '', d.status, d.location || ''].join(',')
      );
      const csv = [headers.join(','), ...rows].join('\n');
      
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="devices_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return c.json({
      code: 0,
      data: devices,
    });
  } catch (error) {
    console.error('Batch export error:', error);
    return c.json({ code: 500, message: '批量导出失败' }, 500);
  }
});

// 设备统计接口
deviceRoutes.get('/stats', authMiddleware, async (c) => {
  try {
    const devices = await db.select().from(schema.devices);
    
    const stats = {
      total: devices.length,
      online: devices.filter(d => d.status === 'online').length,
      offline: devices.filter(d => d.status === 'offline').length,
      warning: devices.filter(d => d.status === 'warning').length,
      error: devices.filter(d => d.status === 'error').length,
      byType: {} as Record<string, number>,
      byVendor: {} as Record<string, number>,
    };

    devices.forEach(d => {
      stats.byType[d.type] = (stats.byType[d.type] || 0) + 1;
      if (d.vendor) stats.byVendor[d.vendor] = (stats.byVendor[d.vendor] || 0) + 1;
    });

    return c.json({ code: 0, data: stats });
  } catch (error) {
    console.error('Get device stats error:', error);
    return c.json({ code: 500, message: '获取设备统计失败' }, 500);
  }
});

export { deviceRoutes };
