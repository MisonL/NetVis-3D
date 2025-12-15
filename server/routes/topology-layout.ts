import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const topologyLayoutRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 拓扑布局存储
const topologyLayouts = new Map<string, {
  id: string;
  name: string;
  description: string;
  nodes: { id: string; x: number; y: number; z?: number }[];
  viewMode: '2d' | '3d';
  zoom: number;
  center: { x: number; y: number; z?: number };
  isDefault: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}>();

// 初始化默认布局
const defaultLayout = {
  id: 'default',
  name: '默认布局',
  description: '系统默认拓扑布局',
  nodes: [],
  viewMode: '3d' as const,
  zoom: 1,
  center: { x: 0, y: 0, z: 0 },
  isDefault: true,
  createdBy: 'system',
  createdAt: new Date(),
  updatedAt: new Date(),
};
topologyLayouts.set('default', defaultLayout);

// 获取布局列表
topologyLayoutRoutes.get('/layouts', authMiddleware, async (c) => {
  const layouts = Array.from(topologyLayouts.values())
    .map(l => ({
      id: l.id,
      name: l.name,
      description: l.description,
      viewMode: l.viewMode,
      isDefault: l.isDefault,
      createdBy: l.createdBy,
      createdAt: l.createdAt,
    }));

  return c.json({ code: 0, data: layouts });
});

// 获取布局详情
topologyLayoutRoutes.get('/layouts/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const layout = topologyLayouts.get(id);

  if (!layout) {
    return c.json({ code: 404, message: '布局不存在' }, 404);
  }

  return c.json({ code: 0, data: layout });
});

// 保存布局
topologyLayoutRoutes.post('/layouts', authMiddleware, zValidator('json', z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  nodes: z.array(z.object({
    id: z.string(),
    x: z.number(),
    y: z.number(),
    z: z.number().optional(),
  })),
  viewMode: z.enum(['2d', '3d']).default('3d'),
  zoom: z.number().optional(),
  center: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number().optional(),
  }).optional(),
})), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const id = crypto.randomUUID();
    topologyLayouts.set(id, {
      id,
      name: data.name,
      description: data.description || '',
      nodes: data.nodes,
      viewMode: data.viewMode,
      zoom: data.zoom || 1,
      center: data.center || { x: 0, y: 0, z: 0 },
      isDefault: false,
      createdBy: currentUser.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'create_topology_layout',
      resource: 'topology',
      details: JSON.stringify({ layoutId: id, name: data.name }),
    });

    return c.json({ code: 0, message: '布局保存成功', data: { id } });
  } catch (error) {
    return c.json({ code: 500, message: '保存失败' }, 500);
  }
});

// 更新布局
topologyLayoutRoutes.put('/layouts/:id', authMiddleware, zValidator('json', z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  nodes: z.array(z.object({
    id: z.string(),
    x: z.number(),
    y: z.number(),
    z: z.number().optional(),
  })).optional(),
  viewMode: z.enum(['2d', '3d']).optional(),
  zoom: z.number().optional(),
  center: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number().optional(),
  }).optional(),
})), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  try {
    const layout = topologyLayouts.get(id);
    if (!layout) {
      return c.json({ code: 404, message: '布局不存在' }, 404);
    }

    if (data.name) layout.name = data.name;
    if (data.description !== undefined) layout.description = data.description;
    if (data.nodes) layout.nodes = data.nodes;
    if (data.viewMode) layout.viewMode = data.viewMode;
    if (data.zoom !== undefined) layout.zoom = data.zoom;
    if (data.center) layout.center = data.center;
    layout.updatedAt = new Date();

    return c.json({ code: 0, message: '布局更新成功' });
  } catch (error) {
    return c.json({ code: 500, message: '更新失败' }, 500);
  }
});

// 删除布局
topologyLayoutRoutes.delete('/layouts/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');

  try {
    const layout = topologyLayouts.get(id);
    if (!layout) {
      return c.json({ code: 404, message: '布局不存在' }, 404);
    }

    if (layout.isDefault) {
      return c.json({ code: 400, message: '不能删除默认布局' }, 400);
    }

    topologyLayouts.delete(id);
    return c.json({ code: 0, message: '布局删除成功' });
  } catch (error) {
    return c.json({ code: 500, message: '删除失败' }, 500);
  }
});

// 设置默认布局
topologyLayoutRoutes.put('/layouts/:id/default', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');

  try {
    const layout = topologyLayouts.get(id);
    if (!layout) {
      return c.json({ code: 404, message: '布局不存在' }, 404);
    }

    // 取消其他默认
    topologyLayouts.forEach(l => { l.isDefault = false; });
    layout.isDefault = true;

    return c.json({ code: 0, message: '已设为默认布局' });
  } catch (error) {
    return c.json({ code: 500, message: '操作失败' }, 500);
  }
});

// 导出拓扑为图片数据URL（前端实现，后端只记录）
topologyLayoutRoutes.post('/export', authMiddleware, zValidator('json', z.object({
  format: z.enum(['png', 'svg', 'json']),
  layoutId: z.string().optional(),
})), async (c) => {
  const { format, layoutId } = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'export_topology',
      resource: 'topology',
      details: JSON.stringify({ format, layoutId }),
    });

    // 实际导出由前端完成，后端只记录
    return c.json({ 
      code: 0, 
      message: '导出请求已记录，请在前端完成实际导出',
      data: { format, layoutId }
    });
  } catch (error) {
    return c.json({ code: 500, message: '导出失败' }, 500);
  }
});

export { topologyLayoutRoutes };
