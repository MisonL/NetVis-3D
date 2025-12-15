import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc, like, and, inArray } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const tagsRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 标签存储
const tags = new Map<string, {
  id: string;
  name: string;
  color: string;
  description: string;
  deviceCount: number;
  createdAt: Date;
}>();

// 设备-标签关联
const deviceTags = new Map<string, string[]>(); // deviceId -> tagIds[]

// 初始化示例标签
const sampleTags = [
  { id: 'tag-1', name: '核心设备', color: '#f5222d', description: '核心交换机/路由器', deviceCount: 12 },
  { id: 'tag-2', name: '接入层', color: '#1677ff', description: '接入层设备', deviceCount: 45 },
  { id: 'tag-3', name: '生产环境', color: '#52c41a', description: '生产环境设备', deviceCount: 80 },
  { id: 'tag-4', name: '测试环境', color: '#faad14', description: '测试环境设备', deviceCount: 20 },
  { id: 'tag-5', name: '待维护', color: '#722ed1', description: '计划维护设备', deviceCount: 5 },
];
sampleTags.forEach(t => tags.set(t.id, { ...t, createdAt: new Date() }));

// 获取所有标签
tagsRoutes.get('/', authMiddleware, async (c) => {
  const tagList = Array.from(tags.values());
  return c.json({ code: 0, data: tagList });
});

// 创建标签
tagsRoutes.post('/', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  name: z.string().min(1),
  color: z.string(),
  description: z.string().optional(),
})), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const id = crypto.randomUUID();
    tags.set(id, {
      id,
      name: data.name,
      color: data.color,
      description: data.description || '',
      deviceCount: 0,
      createdAt: new Date(),
    });

    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'create_tag',
      resource: 'tags',
      details: JSON.stringify({ tagId: id, name: data.name }),
    });

    return c.json({ code: 0, message: '标签创建成功', data: { id } });
  } catch (error) {
    return c.json({ code: 500, message: '创建失败' }, 500);
  }
});

// 更新标签
tagsRoutes.put('/:id', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  name: z.string().optional(),
  color: z.string().optional(),
  description: z.string().optional(),
})), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  try {
    const tag = tags.get(id);
    if (!tag) return c.json({ code: 404, message: '标签不存在' }, 404);

    if (data.name) tag.name = data.name;
    if (data.color) tag.color = data.color;
    if (data.description !== undefined) tag.description = data.description;

    return c.json({ code: 0, message: '标签更新成功' });
  } catch (error) {
    return c.json({ code: 500, message: '更新失败' }, 500);
  }
});

// 删除标签
tagsRoutes.delete('/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');

  try {
    if (!tags.has(id)) return c.json({ code: 404, message: '标签不存在' }, 404);
    tags.delete(id);
    return c.json({ code: 0, message: '标签删除成功' });
  } catch (error) {
    return c.json({ code: 500, message: '删除失败' }, 500);
  }
});

// 为设备添加标签
tagsRoutes.post('/assign', authMiddleware, zValidator('json', z.object({
  deviceIds: z.array(z.string()),
  tagIds: z.array(z.string()),
})), async (c) => {
  const { deviceIds, tagIds } = c.req.valid('json');

  try {
    for (const deviceId of deviceIds) {
      const existing = deviceTags.get(deviceId) || [];
      const newTags = [...new Set([...existing, ...tagIds])];
      deviceTags.set(deviceId, newTags);
    }

    // 更新标签计数
    tagIds.forEach(tagId => {
      const tag = tags.get(tagId);
      if (tag) tag.deviceCount += deviceIds.length;
    });

    return c.json({ code: 0, message: '标签已分配' });
  } catch (error) {
    return c.json({ code: 500, message: '分配失败' }, 500);
  }
});

// 获取设备的标签
tagsRoutes.get('/device/:deviceId', authMiddleware, async (c) => {
  const deviceId = c.req.param('deviceId');
  const tagIds = deviceTags.get(deviceId) || [];
  const deviceTagList = tagIds.map(id => tags.get(id)).filter(Boolean);

  return c.json({ code: 0, data: deviceTagList });
});

// 按标签筛选设备
tagsRoutes.get('/:id/devices', authMiddleware, async (c) => {
  const tagId = c.req.param('id');
  const deviceIds = Array.from(deviceTags.entries())
    .filter(([_, tagIds]) => tagIds.includes(tagId))
    .map(([deviceId]) => deviceId);

  return c.json({ code: 0, data: { tagId, deviceIds, count: deviceIds.length } });
});

export { tagsRoutes };
