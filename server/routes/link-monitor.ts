import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const linkMonitorRoutes = new Hono<{ Variables: { user: JwtPayload } }>();

// 链路存储
const links = new Map<string, {
  id: string;
  name: string;
  sourceDevice: string;
  sourcePort: string;
  targetDevice: string;
  targetPort: string;
  bandwidth: number;
  status: 'up' | 'down' | 'degraded';
  latency: number;
  packetLoss: number;
  utilization: number;
  lastCheck: Date;
}>();

// 初始化示例数据
[
  { id: 'link-1', name: '核心-汇聚1', sourceDevice: 'Core-SW1', sourcePort: 'GE0/0/1', targetDevice: 'Agg-SW1', targetPort: 'GE0/0/49', bandwidth: 10000, status: 'up' as const, latency: 0.5, packetLoss: 0, utilization: 45 },
  { id: 'link-2', name: '核心-汇聚2', sourceDevice: 'Core-SW1', sourcePort: 'GE0/0/2', targetDevice: 'Agg-SW2', targetPort: 'GE0/0/49', bandwidth: 10000, status: 'up' as const, latency: 0.6, packetLoss: 0.01, utilization: 62 },
  { id: 'link-3', name: '汇聚-接入', sourceDevice: 'Agg-SW1', sourcePort: 'GE0/0/1', targetDevice: 'Acc-SW1', targetPort: 'GE0/0/24', bandwidth: 1000, status: 'degraded' as const, latency: 2.5, packetLoss: 0.5, utilization: 85 },
  { id: 'link-4', name: '广域网链路', sourceDevice: 'Router-1', sourcePort: 'GE0/0/0', targetDevice: 'ISP-Router', targetPort: 'eth0', bandwidth: 1000, status: 'up' as const, latency: 15, packetLoss: 0.02, utilization: 35 },
].forEach(l => links.set(l.id, { ...l, lastCheck: new Date() }));

// 获取链路列表
linkMonitorRoutes.get('/', authMiddleware, async (c) => {
  return c.json({ code: 0, data: Array.from(links.values()) });
});

// 获取链路详情
linkMonitorRoutes.get('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const link = links.get(id);
  if (!link) return c.json({ code: 404, message: '链路不存在' }, 404);
  
  // 生成历史数据
  const history = Array.from({ length: 24 }, (_, i) => ({
    time: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
    latency: link.latency + Math.random() * 2 - 1,
    utilization: Math.min(100, Math.max(0, link.utilization + Math.random() * 20 - 10)),
    packetLoss: Math.max(0, link.packetLoss + Math.random() * 0.1),
  }));
  
  return c.json({ code: 0, data: { ...link, history } });
});

// 添加链路
linkMonitorRoutes.post('/', authMiddleware, zValidator('json', z.object({
  name: z.string(),
  sourceDevice: z.string(),
  sourcePort: z.string(),
  targetDevice: z.string(),
  targetPort: z.string(),
  bandwidth: z.number(),
})), async (c) => {
  const data = c.req.valid('json');
  const id = crypto.randomUUID();
  links.set(id, { id, ...data, status: 'up', latency: 0, packetLoss: 0, utilization: 0, lastCheck: new Date() });
  return c.json({ code: 0, message: '链路已添加', data: { id } });
});

// 删除链路
linkMonitorRoutes.delete('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  if (!links.has(id)) return c.json({ code: 404, message: '链路不存在' }, 404);
  links.delete(id);
  return c.json({ code: 0, message: '链路已删除' });
});

// 链路统计
linkMonitorRoutes.get('/stats/overview', authMiddleware, async (c) => {
  const allLinks = Array.from(links.values());
  return c.json({
    code: 0,
    data: {
      total: allLinks.length,
      up: allLinks.filter(l => l.status === 'up').length,
      down: allLinks.filter(l => l.status === 'down').length,
      degraded: allLinks.filter(l => l.status === 'degraded').length,
      avgLatency: (allLinks.reduce((s, l) => s + l.latency, 0) / allLinks.length).toFixed(2),
      avgUtilization: (allLinks.reduce((s, l) => s + l.utilization, 0) / allLinks.length).toFixed(1),
      highUtilization: allLinks.filter(l => l.utilization > 80).length,
    },
  });
});

// 链路拓扑数据
linkMonitorRoutes.get('/topology/data', authMiddleware, async (c) => {
  const allLinks = Array.from(links.values());
  const devices = new Set<string>();
  allLinks.forEach(l => { devices.add(l.sourceDevice); devices.add(l.targetDevice); });
  
  const nodes = Array.from(devices).map(d => ({ id: d, name: d, type: d.includes('Router') ? 'router' : 'switch' }));
  const edges = allLinks.map(l => ({ id: l.id, source: l.sourceDevice, target: l.targetDevice, status: l.status, bandwidth: l.bandwidth }));
  
  return c.json({ code: 0, data: { nodes, edges } });
});

export { linkMonitorRoutes };
