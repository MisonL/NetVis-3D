import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc, like } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const knowledgeRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 知识库存储
const articles = new Map<string, {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  author: string;
  views: number;
  createdAt: Date;
  updatedAt: Date;
}>();

// 初始化示例文章
const sampleArticles = [
  { id: '1', title: '华为交换机常用命令', category: '配置指南', tags: ['华为', '交换机'], content: '# 华为交换机常用命令\n\n## 基础命令\n- display current-configuration\n- display interface brief\n- display ip routing-table' },
  { id: '2', title: 'Cisco设备密码重置', category: '故障处理', tags: ['Cisco', '密码'], content: '# Cisco设备密码重置步骤\n\n1. 进入ROMMON模式\n2. 修改配置寄存器\n3. 重启设备' },
  { id: '3', title: 'SNMP配置最佳实践', category: '最佳实践', tags: ['SNMP', '安全'], content: '# SNMP配置最佳实践\n\n## 安全建议\n- 使用SNMP v3\n- 配置访问控制列表' },
  { id: '4', title: '网络故障排查流程', category: '故障处理', tags: ['故障', '排查'], content: '# 网络故障排查流程\n\n## 步骤\n1. 确认故障现象\n2. 检查物理连接\n3. 验证IP配置' },
  { id: '5', title: 'BGP邻居建立问题', category: '故障处理', tags: ['BGP', '路由'], content: '# BGP邻居建立常见问题\n\n## 检查点\n- AS号配置\n- 对等体IP地址\n- MD5认证' },
];

sampleArticles.forEach(a => {
  articles.set(a.id, { ...a, author: 'admin', views: Math.floor(Math.random() * 100), createdAt: new Date(), updatedAt: new Date() });
});

// 获取文章列表
knowledgeRoutes.get('/articles', authMiddleware, async (c) => {
  const category = c.req.query('category');
  const search = c.req.query('search');

  let list = Array.from(articles.values());

  if (category) {
    list = list.filter(a => a.category === category);
  }

  if (search) {
    const s = search.toLowerCase();
    list = list.filter(a => 
      a.title.toLowerCase().includes(s) || 
      a.content.toLowerCase().includes(s) ||
      a.tags.some(t => t.toLowerCase().includes(s))
    );
  }

  return c.json({
    code: 0,
    data: list.map(a => ({
      id: a.id,
      title: a.title,
      category: a.category,
      tags: a.tags,
      author: a.author,
      views: a.views,
      createdAt: a.createdAt,
    })),
  });
});

// 获取文章详情
knowledgeRoutes.get('/articles/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const article = articles.get(id);

  if (!article) {
    return c.json({ code: 404, message: '文章不存在' }, 404);
  }

  article.views++;
  return c.json({ code: 0, data: article });
});

// 创建文章
knowledgeRoutes.post('/articles', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  title: z.string().min(1),
  content: z.string(),
  category: z.string(),
  tags: z.array(z.string()).optional(),
})), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const id = crypto.randomUUID();
    articles.set(id, {
      id,
      title: data.title,
      content: data.content,
      category: data.category,
      tags: data.tags || [],
      author: currentUser.userId,
      views: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'create_article',
      resource: 'knowledge',
      details: JSON.stringify({ articleId: id, title: data.title }),
    });

    return c.json({ code: 0, message: '文章创建成功', data: { id } });
  } catch (error) {
    return c.json({ code: 500, message: '创建失败' }, 500);
  }
});

// 更新文章
knowledgeRoutes.put('/articles/:id', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
})), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  try {
    const article = articles.get(id);
    if (!article) {
      return c.json({ code: 404, message: '文章不存在' }, 404);
    }

    if (data.title) article.title = data.title;
    if (data.content) article.content = data.content;
    if (data.category) article.category = data.category;
    if (data.tags) article.tags = data.tags;
    article.updatedAt = new Date();

    return c.json({ code: 0, message: '文章更新成功' });
  } catch (error) {
    return c.json({ code: 500, message: '更新失败' }, 500);
  }
});

// 删除文章
knowledgeRoutes.delete('/articles/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const currentUser = c.get('user');

  try {
    if (!articles.has(id)) {
      return c.json({ code: 404, message: '文章不存在' }, 404);
    }

    articles.delete(id);

    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'delete_article',
      resource: 'knowledge',
      details: JSON.stringify({ articleId: id }),
    });

    return c.json({ code: 0, message: '文章删除成功' });
  } catch (error) {
    return c.json({ code: 500, message: '删除失败' }, 500);
  }
});

// 获取分类列表
knowledgeRoutes.get('/categories', authMiddleware, async (c) => {
  const categoryMap = new Map<string, number>();
  articles.forEach(a => {
    categoryMap.set(a.category, (categoryMap.get(a.category) || 0) + 1);
  });

  const categories = Array.from(categoryMap.entries()).map(([name, count]) => ({ name, count }));

  return c.json({ code: 0, data: categories });
});

// 获取热门标签
knowledgeRoutes.get('/tags', authMiddleware, async (c) => {
  const tagMap = new Map<string, number>();
  articles.forEach(a => {
    a.tags.forEach(tag => {
      tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
    });
  });

  const tags = Array.from(tagMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return c.json({ code: 0, data: tags });
});

// 获取热门文章
knowledgeRoutes.get('/popular', authMiddleware, async (c) => {
  const popular = Array.from(articles.values())
    .sort((a, b) => b.views - a.views)
    .slice(0, 10)
    .map(a => ({ id: a.id, title: a.title, views: a.views }));

  return c.json({ code: 0, data: popular });
});

export { knowledgeRoutes };
