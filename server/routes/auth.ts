import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { generateToken, authMiddleware } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const authRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 登录请求验证
const loginSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
});

// 注册请求验证
const registerSchema = z.object({
  username: z.string().min(3, '用户名至少3个字符').max(50),
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少6个字符'),
  displayName: z.string().optional(),
});

// 登录
authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const { username, password } = c.req.valid('json');

  try {
    // 查询用户
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);

    if (!user) {
      return c.json({ code: 401, message: '用户名或密码错误' }, 401);
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return c.json({ code: 401, message: '用户名或密码错误' }, 401);
    }

    // 检查用户状态
    if (!user.isActive) {
      return c.json({ code: 403, message: '账户已被禁用' }, 403);
    }

    // 更新最后登录时间
    await db
      .update(schema.users)
      .set({ lastLoginAt: new Date() })
      .where(eq(schema.users.id, user.id));

    // 生成Token
    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    // 记录审计日志
    await db.insert(schema.auditLogs).values({
      userId: user.id,
      action: 'login',
      resource: 'auth',
      details: JSON.stringify({ ip: c.req.header('x-forwarded-for') || 'unknown' }),
      ipAddress: c.req.header('x-forwarded-for') || null,
      userAgent: c.req.header('user-agent') || null,
    });

    return c.json({
      code: 0,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          avatar: user.avatar,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ code: 500, message: '登录失败，请稍后重试' }, 500);
  }
});

// 注册（仅管理员可用，或首次初始化）
authRoutes.post('/register', zValidator('json', registerSchema), async (c) => {
  const { username, email, password, displayName } = c.req.valid('json');

  try {
    // 检查用户名是否已存在
    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);

    if (existing) {
      return c.json({ code: 400, message: '用户名已存在' }, 400);
    }

    // 检查邮箱是否已存在
    const [existingEmail] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (existingEmail) {
      return c.json({ code: 400, message: '邮箱已被使用' }, 400);
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 检查是否是第一个用户（设为管理员）
    const [userCount] = await db
      .select({ count: schema.users.id })
      .from(schema.users);
    
    const isFirstUser = !userCount;

    // 创建用户
    const [newUser] = await db
      .insert(schema.users)
      .values({
        username,
        email,
        password: hashedPassword,
        displayName: displayName || username,
        role: isFirstUser ? 'admin' : 'user',
      })
      .returning();

    if (!newUser) {
      return c.json({ code: 500, message: '创建用户失败' }, 500);
    }

    return c.json({
      code: 0,
      message: '注册成功',
      data: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return c.json({ code: 500, message: '注册失败，请稍后重试' }, 500);
  }
});

// 获取当前用户信息
authRoutes.get('/me', authMiddleware, async (c) => {
  const jwtUser = c.get('user') as JwtPayload;

  try {
    const [user] = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        email: schema.users.email,
        displayName: schema.users.displayName,
        role: schema.users.role,
        avatar: schema.users.avatar,
        lastLoginAt: schema.users.lastLoginAt,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, jwtUser.userId))
      .limit(1);

    if (!user) {
      return c.json({ code: 404, message: '用户不存在' }, 404);
    }

    return c.json({
      code: 0,
      data: user,
    });
  } catch (error) {
    console.error('Get user error:', error);
    return c.json({ code: 500, message: '获取用户信息失败' }, 500);
  }
});

// 登出（记录日志）
authRoutes.post('/logout', authMiddleware, async (c) => {
  const user = c.get('user') as JwtPayload;

  try {
    await db.insert(schema.auditLogs).values({
      userId: user.userId,
      action: 'logout',
      resource: 'auth',
      ipAddress: c.req.header('x-forwarded-for') || null,
      userAgent: c.req.header('user-agent') || null,
    });

    return c.json({ code: 0, message: '登出成功' });
  } catch (error) {
    return c.json({ code: 0, message: '登出成功' });
  }
});

// 修改密码
authRoutes.put('/password', authMiddleware, zValidator('json', z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(6),
})), async (c) => {
  const user = c.get('user') as JwtPayload;
  const { oldPassword, newPassword } = c.req.valid('json');

  try {
    const [dbUser] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, user.userId))
      .limit(1);

    if (!dbUser) {
      return c.json({ code: 404, message: '用户不存在' }, 404);
    }

    const isValid = await bcrypt.compare(oldPassword, dbUser.password);
    if (!isValid) {
      return c.json({ code: 400, message: '原密码错误' }, 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db
      .update(schema.users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(schema.users.id, user.userId));

    // 记录审计日志
    await db.insert(schema.auditLogs).values({
      userId: user.userId,
      action: 'update',
      resource: 'password',
      ipAddress: c.req.header('x-forwarded-for') || null,
      userAgent: c.req.header('user-agent') || null,
    });

    return c.json({ code: 0, message: '密码修改成功' });
  } catch (error) {
    console.error('Change password error:', error);
    return c.json({ code: 500, message: '修改密码失败' }, 500);
  }
});

export { authRoutes };
