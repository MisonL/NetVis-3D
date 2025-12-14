import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db, schema } from '../db';
import { eq, desc, count } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';
import { beforeAddUser } from '../middleware/license';

const userRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 用户列表查询参数
const listQuerySchema = z.object({
  page: z.string().optional().transform(v => parseInt(v || '1')),
  pageSize: z.string().optional().transform(v => parseInt(v || '10')),
  keyword: z.string().optional(),
  role: z.string().optional(),
  isActive: z.string().optional().transform(v => v === 'true' ? true : v === 'false' ? false : undefined),
});

// 创建/更新用户
const userBodySchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6).optional(),
  displayName: z.string().optional(),
  role: z.enum(['admin', 'user', 'viewer']).optional(),
  isActive: z.boolean().optional(),
});

// 获取用户列表（需要管理员权限）
userRoutes.get('/', authMiddleware, requireRole('admin'), zValidator('query', listQuerySchema), async (c) => {
  const { page, pageSize } = c.req.valid('query');
  const offset = (page - 1) * pageSize;

  try {
    const users = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        email: schema.users.email,
        displayName: schema.users.displayName,
        role: schema.users.role,
        isActive: schema.users.isActive,
        lastLoginAt: schema.users.lastLoginAt,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .orderBy(desc(schema.users.createdAt))
      .limit(pageSize)
      .offset(offset);

    // 获取总数
    const totalResult = await db.select({ total: count() }).from(schema.users);
    const total = totalResult[0]?.total ?? 0;

    return c.json({
      code: 0,
      data: {
        list: users,
        total,
        page,
        pageSize,
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    return c.json({ code: 500, message: '获取用户列表失败' }, 500);
  }
});

// 获取单个用户
userRoutes.get('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const currentUser = c.get('user');

  // 非管理员只能查看自己
  if (currentUser.role !== 'admin' && currentUser.userId !== id) {
    return c.json({ code: 403, message: '权限不足' }, 403);
  }

  try {
    const [user] = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        email: schema.users.email,
        displayName: schema.users.displayName,
        role: schema.users.role,
        isActive: schema.users.isActive,
        avatar: schema.users.avatar,
        lastLoginAt: schema.users.lastLoginAt,
        createdAt: schema.users.createdAt,
        updatedAt: schema.users.updatedAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);

    if (!user) {
      return c.json({ code: 404, message: '用户不存在' }, 404);
    }

    return c.json({ code: 0, data: user });
  } catch (error) {
    console.error('Get user error:', error);
    return c.json({ code: 500, message: '获取用户信息失败' }, 500);
  }
});

// 创建用户（管理员）
userRoutes.post('/', authMiddleware, requireRole('admin'), zValidator('json', userBodySchema), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    // License用户数检查
    const licenseCheck = await beforeAddUser();
    if (!licenseCheck.allowed) {
      return c.json({ 
        code: 403, 
        message: licenseCheck.message,
        data: { upgradeUrl: '/settings/license' }
      }, 403);
    }

    // 检查用户名
    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, data.username))
      .limit(1);

    if (existing) {
      return c.json({ code: 400, message: '用户名已存在' }, 400);
    }

    // 检查邮箱
    const [existingEmail] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, data.email))
      .limit(1);

    if (existingEmail) {
      return c.json({ code: 400, message: '邮箱已被使用' }, 400);
    }

    // 密码必须提供
    if (!data.password) {
      return c.json({ code: 400, message: '密码不能为空' }, 400);
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const result = await db
      .insert(schema.users)
      .values({
        username: data.username,
        email: data.email,
        password: hashedPassword,
        displayName: data.displayName || data.username,
        role: data.role || 'user',
        isActive: data.isActive ?? true,
      })
      .returning();

    const newUser = result[0];
    if (!newUser) {
      return c.json({ code: 500, message: '创建用户失败' }, 500);
    }

    // 记录审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'create',
      resource: 'users',
      resourceId: newUser.id,
      details: JSON.stringify({ username: newUser.username }),
    });

    return c.json({
      code: 0,
      message: '用户创建成功',
      data: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error('Create user error:', error);
    return c.json({ code: 500, message: '创建用户失败' }, 500);
  }
});

// 更新用户
userRoutes.put('/:id', authMiddleware, zValidator('json', userBodySchema.partial()), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  // 非管理员只能修改自己
  if (currentUser.role !== 'admin' && currentUser.userId !== id) {
    return c.json({ code: 403, message: '权限不足' }, 403);
  }

  // 非管理员不能修改角色和状态
  if (currentUser.role !== 'admin') {
    delete data.role;
    delete data.isActive;
  }

  try {
    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);

    if (!existing) {
      return c.json({ code: 404, message: '用户不存在' }, 404);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    await db
      .update(schema.users)
      .set(updateData)
      .where(eq(schema.users.id, id));

    // 记录审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'update',
      resource: 'users',
      resourceId: id,
      details: JSON.stringify({ fields: Object.keys(updateData) }),
    });

    return c.json({ code: 0, message: '更新成功' });
  } catch (error) {
    console.error('Update user error:', error);
    return c.json({ code: 500, message: '更新用户失败' }, 500);
  }
});

// 删除用户（管理员）
userRoutes.delete('/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const currentUser = c.get('user');

  // 不能删除自己
  if (currentUser.userId === id) {
    return c.json({ code: 400, message: '不能删除当前登录用户' }, 400);
  }

  try {
    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);

    if (!existing) {
      return c.json({ code: 404, message: '用户不存在' }, 404);
    }

    await db.delete(schema.users).where(eq(schema.users.id, id));

    // 记录审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'delete',
      resource: 'users',
      resourceId: id,
      details: JSON.stringify({ username: existing.username }),
    });

    return c.json({ code: 0, message: '删除成功' });
  } catch (error) {
    console.error('Delete user error:', error);
    return c.json({ code: 500, message: '删除用户失败' }, 500);
  }
});

export { userRoutes };
