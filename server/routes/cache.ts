import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const cacheRoutes = new Hono<{ Variables: { user: JwtPayload } }>();

// 模拟Redis缓存状态
const cacheStats = {
  connected: true,
  host: 'localhost:6379',
  usedMemory: '256.5 MB',
  maxMemory: '1 GB',
  hitRate: 94.5,
  keys: 15234,
  uptime: '15d 4h 32m',
  clients: 12,
  ops: 1523,
};

// 缓存键
const cacheKeys = new Map<string, {
  key: string;
  type: 'string' | 'hash' | 'list' | 'set' | 'zset';
  size: number;
  ttl: number;
  lastAccess: Date;
}>();

// 初始化示例数据
[
  { key: 'session:user:admin', type: 'hash' as const, size: 1024, ttl: 3600 },
  { key: 'device:status:all', type: 'hash' as const, size: 102400, ttl: 60 },
  { key: 'alert:active', type: 'list' as const, size: 8192, ttl: -1 },
  { key: 'metrics:cpu:latest', type: 'string' as const, size: 512, ttl: 30 },
  { key: 'topology:cache', type: 'string' as const, size: 204800, ttl: 300 },
].forEach(k => cacheKeys.set(k.key, { ...k, lastAccess: new Date() }));

// 获取缓存状态
cacheRoutes.get('/status', authMiddleware, async (c) => {
  return c.json({ code: 0, data: cacheStats });
});

// 获取缓存键列表
cacheRoutes.get('/keys', authMiddleware, async (c) => {
  const pattern = c.req.query('pattern') || '*';
  let keys = Array.from(cacheKeys.values());
  if (pattern !== '*') {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    keys = keys.filter(k => regex.test(k.key));
  }
  return c.json({ code: 0, data: keys });
});

// 获取键详情
cacheRoutes.get('/keys/:key', authMiddleware, async (c) => {
  const key = c.req.param('key');
  const cacheKey = cacheKeys.get(key);
  if (!cacheKey) return c.json({ code: 404, message: '键不存在' }, 404);
  
  // 模拟值
  const value = cacheKey.type === 'string' ? '{"sample": "data"}' : 
                cacheKey.type === 'hash' ? { field1: 'value1', field2: 'value2' } :
                cacheKey.type === 'list' ? ['item1', 'item2', 'item3'] : null;
  
  return c.json({ code: 0, data: { ...cacheKey, value } });
});

// 删除缓存键
cacheRoutes.delete('/keys/:key', authMiddleware, requireRole('admin'), async (c) => {
  const key = c.req.param('key');
  if (!cacheKeys.has(key)) return c.json({ code: 404, message: '键不存在' }, 404);
  cacheKeys.delete(key);
  return c.json({ code: 0, message: '键已删除' });
});

// 清空缓存
cacheRoutes.post('/flush', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  pattern: z.string().optional(),
  confirm: z.boolean(),
})), async (c) => {
  const { pattern, confirm } = c.req.valid('json');
  if (!confirm) return c.json({ code: 400, message: '需要确认' }, 400);
  
  if (pattern) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    for (const key of cacheKeys.keys()) {
      if (regex.test(key)) cacheKeys.delete(key);
    }
    return c.json({ code: 0, message: `匹配的键已清除` });
  }
  
  cacheKeys.clear();
  return c.json({ code: 0, message: '缓存已清空' });
});

// 缓存统计
cacheRoutes.get('/stats', authMiddleware, async (c) => {
  const keys = Array.from(cacheKeys.values());
  return c.json({
    code: 0,
    data: {
      totalKeys: keys.length,
      totalSize: (keys.reduce((s, k) => s + k.size, 0) / 1024).toFixed(2) + ' KB',
      byType: {
        string: keys.filter(k => k.type === 'string').length,
        hash: keys.filter(k => k.type === 'hash').length,
        list: keys.filter(k => k.type === 'list').length,
        set: keys.filter(k => k.type === 'set').length,
        zset: keys.filter(k => k.type === 'zset').length,
      },
      expiring: keys.filter(k => k.ttl > 0).length,
      persistent: keys.filter(k => k.ttl === -1).length,
    },
  });
});

// 缓存配置
cacheRoutes.get('/config', authMiddleware, async (c) => {
  return c.json({
    code: 0,
    data: {
      maxMemory: '1 GB',
      maxMemoryPolicy: 'allkeys-lru',
      timeout: 300,
      databases: 16,
      requirepass: true,
      appendonly: true,
    },
  });
});

// 更新缓存配置
cacheRoutes.put('/config', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  maxMemory: z.string().optional(),
  maxMemoryPolicy: z.string().optional(),
  timeout: z.number().optional(),
})), async (c) => {
  return c.json({ code: 0, message: '配置已更新（模拟）' });
});

export { cacheRoutes };
