import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc, gte, and } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const securityRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 活跃会话存储
const activeSessions = new Map<string, {
  sessionId: string;
  userId: string;
  username: string;
  ip: string;
  userAgent: string;
  loginAt: Date;
  lastActiveAt: Date;
  location?: string;
}>();

// 登录历史
const loginHistory: {
  id: string;
  userId: string;
  username: string;
  ip: string;
  userAgent: string;
  success: boolean;
  failReason?: string;
  createdAt: Date;
}[] = [];

// 安全策略配置
const securityPolicies = {
  maxLoginAttempts: 5,
  lockoutDuration: 30, // 分钟
  sessionTimeout: 24, // 小时
  passwordMinLength: 8,
  passwordRequireUppercase: true,
  passwordRequireLowercase: true,
  passwordRequireNumber: true,
  passwordRequireSpecial: false,
  twoFactorEnabled: false,
  ipWhitelist: [] as string[],
  ipBlacklist: [] as string[],
};

// 被锁定的用户
const lockedUsers = new Map<string, { lockedAt: Date; attempts: number }>();

// 添加模拟会话
const mockSessions = [
  { sessionId: 's1', userId: '1', username: 'admin', ip: '192.168.1.100', userAgent: 'Chrome/120', loginAt: new Date(Date.now() - 3600000), lastActiveAt: new Date() },
  { sessionId: 's2', userId: '2', username: 'operator', ip: '192.168.1.101', userAgent: 'Firefox/122', loginAt: new Date(Date.now() - 7200000), lastActiveAt: new Date(Date.now() - 1800000) },
];
mockSessions.forEach(s => activeSessions.set(s.sessionId, s));

// 获取活跃会话列表
securityRoutes.get('/sessions', authMiddleware, requireRole('admin'), async (c) => {
  const sessions = Array.from(activeSessions.values())
    .sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime());

  return c.json({ code: 0, data: sessions });
});

// 强制下线会话
securityRoutes.delete('/sessions/:id', authMiddleware, requireRole('admin'), async (c) => {
  const sessionId = c.req.param('id');
  const currentUser = c.get('user');

  try {
    if (!activeSessions.has(sessionId)) {
      return c.json({ code: 404, message: '会话不存在' }, 404);
    }

    const session = activeSessions.get(sessionId);
    activeSessions.delete(sessionId);

    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'force_logout',
      resource: 'session',
      details: JSON.stringify({ sessionId, targetUser: session?.username }),
    });

    return c.json({ code: 0, message: '已强制下线' });
  } catch (error) {
    return c.json({ code: 500, message: '操作失败' }, 500);
  }
});

// 获取登录历史
securityRoutes.get('/login-history', authMiddleware, requireRole('admin'), async (c) => {
  const limit = parseInt(c.req.query('limit') || '50');
  const history = loginHistory.slice(-limit).reverse();

  return c.json({ code: 0, data: history });
});

// 获取安全策略
securityRoutes.get('/policies', authMiddleware, requireRole('admin'), async (c) => {
  return c.json({ code: 0, data: securityPolicies });
});

// 更新安全策略
securityRoutes.put('/policies', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  maxLoginAttempts: z.number().optional(),
  lockoutDuration: z.number().optional(),
  sessionTimeout: z.number().optional(),
  passwordMinLength: z.number().optional(),
  passwordRequireUppercase: z.boolean().optional(),
  passwordRequireLowercase: z.boolean().optional(),
  passwordRequireNumber: z.boolean().optional(),
  passwordRequireSpecial: z.boolean().optional(),
  twoFactorEnabled: z.boolean().optional(),
})), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    Object.assign(securityPolicies, data);

    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'update_security_policy',
      resource: 'security',
      details: JSON.stringify({ updated: Object.keys(data) }),
    });

    return c.json({ code: 0, message: '安全策略已更新' });
  } catch (error) {
    return c.json({ code: 500, message: '更新失败' }, 500);
  }
});

// IP黑白名单管理
securityRoutes.get('/ip-rules', authMiddleware, requireRole('admin'), async (c) => {
  return c.json({
    code: 0,
    data: {
      whitelist: securityPolicies.ipWhitelist,
      blacklist: securityPolicies.ipBlacklist,
    },
  });
});

securityRoutes.post('/ip-rules', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  type: z.enum(['whitelist', 'blacklist']),
  ip: z.string(),
})), async (c) => {
  const { type, ip } = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    if (type === 'whitelist') {
      if (!securityPolicies.ipWhitelist.includes(ip)) {
        securityPolicies.ipWhitelist.push(ip);
      }
    } else {
      if (!securityPolicies.ipBlacklist.includes(ip)) {
        securityPolicies.ipBlacklist.push(ip);
      }
    }

    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: `add_ip_${type}`,
      resource: 'security',
      details: JSON.stringify({ ip }),
    });

    return c.json({ code: 0, message: 'IP规则已添加' });
  } catch (error) {
    return c.json({ code: 500, message: '添加失败' }, 500);
  }
});

// 获取被锁定的用户
securityRoutes.get('/locked-users', authMiddleware, requireRole('admin'), async (c) => {
  const locked = Array.from(lockedUsers.entries()).map(([userId, info]) => ({
    userId,
    lockedAt: info.lockedAt,
    attempts: info.attempts,
  }));

  return c.json({ code: 0, data: locked });
});

// 解锁用户
securityRoutes.post('/unlock/:userId', authMiddleware, requireRole('admin'), async (c) => {
  const userId = c.req.param('userId');
  const currentUser = c.get('user');

  try {
    lockedUsers.delete(userId);

    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'unlock_user',
      resource: 'security',
      details: JSON.stringify({ unlockedUserId: userId }),
    });

    return c.json({ code: 0, message: '用户已解锁' });
  } catch (error) {
    return c.json({ code: 500, message: '解锁失败' }, 500);
  }
});

// 安全概览统计
securityRoutes.get('/overview', authMiddleware, async (c) => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const stats = {
    activeSessions: activeSessions.size,
    lockedUsers: lockedUsers.size,
    loginAttemptsToday: loginHistory.filter(l => l.createdAt >= yesterday).length,
    failedLoginsToday: loginHistory.filter(l => l.createdAt >= yesterday && !l.success).length,
    ipWhitelistCount: securityPolicies.ipWhitelist.length,
    ipBlacklistCount: securityPolicies.ipBlacklist.length,
    twoFactorEnabled: securityPolicies.twoFactorEnabled,
    lastSecurityUpdate: new Date(),
  };

  return c.json({ code: 0, data: stats });
});

export { securityRoutes };
