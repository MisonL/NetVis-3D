import type { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'netvis-pro-secret-key-change-in-production';

export interface JwtPayload {
  userId: string;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

// 生成JWT Token
export function generateToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

// 验证JWT Token
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

// JWT认证中间件
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ code: 401, message: '未提供认证令牌' }, 401);
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    return c.json({ code: 401, message: '认证令牌无效或已过期' }, 401);
  }

  // 将用户信息存入上下文
  c.set('user', payload);
  await next();
}

// 角色检查中间件
export function requireRole(...allowedRoles: string[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as JwtPayload;
    
    if (!user) {
      return c.json({ code: 401, message: '未认证' }, 401);
    }

    if (!allowedRoles.includes(user.role)) {
      return c.json({ code: 403, message: '权限不足' }, 403);
    }

    await next();
  };
}
