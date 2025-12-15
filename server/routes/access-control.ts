import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const accessControlRoutes = new Hono<{ Variables: { user: JwtPayload } }>();

// ACL规则
const aclRules = new Map<string, {
  id: string;
  name: string;
  type: 'allow' | 'deny';
  source: string;
  destination: string;
  protocol: string;
  port: string;
  priority: number;
  enabled: boolean;
  hitCount: number;
  createdAt: Date;
}>();

// 初始化示例规则
[
  { id: 'acl-1', name: '允许SSH管理', type: 'allow' as const, source: '10.0.0.0/8', destination: 'any', protocol: 'tcp', port: '22', priority: 100, enabled: true, hitCount: 15234 },
  { id: 'acl-2', name: '允许HTTPS', type: 'allow' as const, source: 'any', destination: '192.168.1.100', protocol: 'tcp', port: '443', priority: 110, enabled: true, hitCount: 523456 },
  { id: 'acl-3', name: '拒绝Telnet', type: 'deny' as const, source: 'any', destination: 'any', protocol: 'tcp', port: '23', priority: 50, enabled: true, hitCount: 8921 },
  { id: 'acl-4', name: '允许ICMP', type: 'allow' as const, source: 'any', destination: 'any', protocol: 'icmp', port: 'any', priority: 200, enabled: true, hitCount: 123456 },
].forEach(r => aclRules.set(r.id, { ...r, createdAt: new Date() }));

// 获取ACL规则列表
accessControlRoutes.get('/rules', authMiddleware, async (c) => {
  const rules = Array.from(aclRules.values()).sort((a, b) => a.priority - b.priority);
  return c.json({ code: 0, data: rules });
});

// 创建ACL规则
accessControlRoutes.post('/rules', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  name: z.string(),
  type: z.enum(['allow', 'deny']),
  source: z.string(),
  destination: z.string(),
  protocol: z.string(),
  port: z.string(),
  priority: z.number(),
})), async (c) => {
  const data = c.req.valid('json');
  const id = crypto.randomUUID();
  aclRules.set(id, { id, ...data, enabled: true, hitCount: 0, createdAt: new Date() });
  return c.json({ code: 0, message: 'ACL规则已创建', data: { id } });
});

// 删除ACL规则
accessControlRoutes.delete('/rules/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  if (!aclRules.has(id)) return c.json({ code: 404, message: '规则不存在' }, 404);
  aclRules.delete(id);
  return c.json({ code: 0, message: '规则已删除' });
});

// 启用/禁用规则
accessControlRoutes.post('/rules/:id/toggle', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const rule = aclRules.get(id);
  if (!rule) return c.json({ code: 404, message: '规则不存在' }, 404);
  rule.enabled = !rule.enabled;
  return c.json({ code: 0, message: rule.enabled ? '已启用' : '已禁用' });
});

// 调整优先级
accessControlRoutes.put('/rules/:id/priority', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  priority: z.number(),
})), async (c) => {
  const id = c.req.param('id');
  const { priority } = c.req.valid('json');
  const rule = aclRules.get(id);
  if (!rule) return c.json({ code: 404, message: '规则不存在' }, 404);
  rule.priority = priority;
  return c.json({ code: 0, message: '优先级已更新' });
});

// 测试ACL匹配
accessControlRoutes.post('/test', authMiddleware, zValidator('json', z.object({
  source: z.string(),
  destination: z.string(),
  protocol: z.string(),
  port: z.string(),
})), async (c) => {
  const { source, destination, protocol, port } = c.req.valid('json');
  
  // 简单模拟匹配
  const rules = Array.from(aclRules.values()).filter(r => r.enabled).sort((a, b) => a.priority - b.priority);
  const matched = rules.find(r => r.protocol === protocol || r.protocol === 'any');
  
  return c.json({
    code: 0,
    data: {
      matched: matched ? { id: matched.id, name: matched.name, action: matched.type } : null,
      result: matched ? matched.type : 'deny (default)',
    },
  });
});

// ACL统计
accessControlRoutes.get('/stats', authMiddleware, async (c) => {
  const rules = Array.from(aclRules.values());
  return c.json({
    code: 0,
    data: {
      totalRules: rules.length,
      enabledRules: rules.filter(r => r.enabled).length,
      allowRules: rules.filter(r => r.type === 'allow').length,
      denyRules: rules.filter(r => r.type === 'deny').length,
      totalHits: rules.reduce((s, r) => s + r.hitCount, 0),
      topHitRules: rules.sort((a, b) => b.hitCount - a.hitCount).slice(0, 5).map(r => ({ name: r.name, hits: r.hitCount })),
    },
  });
});

export { accessControlRoutes };
