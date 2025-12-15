import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const portMappingRoutes = new Hono<{ Variables: { user: JwtPayload } }>();

// 端口映射存储
const portMappings = new Map<string, {
  id: string;
  name: string;
  deviceId: string;
  devicePort: string;
  remoteDevice: string;
  remotePort: string;
  protocol: string;
  vlan: number;
  status: 'active' | 'inactive';
  speed: string;
  duplex: string;
  description: string;
  createdAt: Date;
}>();

// VLAN存储
const vlans = new Map<string, {
  id: string;
  vlanId: number;
  name: string;
  description: string;
  portCount: number;
  createdAt: Date;
}>();

// 初始化示例数据
[
  { id: 'pm-1', name: '核心上联', deviceId: 'dev-1', devicePort: 'GE1/0/1', remoteDevice: 'Core-SW', remotePort: 'GE0/0/1', protocol: 'trunk', vlan: 1, status: 'active' as const, speed: '10G', duplex: 'full', description: '核心交换机上联' },
  { id: 'pm-2', name: '服务器接入', deviceId: 'dev-2', devicePort: 'GE1/0/24', remoteDevice: 'Server-01', remotePort: 'eth0', protocol: 'access', vlan: 100, status: 'active' as const, speed: '1G', duplex: 'full', description: '服务器接入端口' },
].forEach(pm => portMappings.set(pm.id, { ...pm, createdAt: new Date() }));

[
  { id: 'vlan-1', vlanId: 1, name: 'DEFAULT', description: '默认VLAN', portCount: 48 },
  { id: 'vlan-100', vlanId: 100, name: 'SERVER', description: '服务器VLAN', portCount: 24 },
  { id: 'vlan-200', vlanId: 200, name: 'OFFICE', description: '办公VLAN', portCount: 96 },
  { id: 'vlan-300', vlanId: 300, name: 'GUEST', description: '访客VLAN', portCount: 12 },
].forEach(v => vlans.set(v.id, { ...v, createdAt: new Date() }));

// 获取端口映射列表
portMappingRoutes.get('/mappings', authMiddleware, async (c) => {
  const deviceId = c.req.query('deviceId');
  let mappings = Array.from(portMappings.values());
  if (deviceId) mappings = mappings.filter(m => m.deviceId === deviceId);
  return c.json({ code: 0, data: mappings });
});

// 创建端口映射
portMappingRoutes.post('/mappings', authMiddleware, zValidator('json', z.object({
  name: z.string(),
  deviceId: z.string(),
  devicePort: z.string(),
  remoteDevice: z.string(),
  remotePort: z.string(),
  protocol: z.string(),
  vlan: z.number(),
  description: z.string().optional(),
})), async (c) => {
  const data = c.req.valid('json');
  const id = crypto.randomUUID();
  portMappings.set(id, { id, ...data, status: 'active', speed: '1G', duplex: 'full', description: data.description || '', createdAt: new Date() });
  return c.json({ code: 0, message: '端口映射已创建', data: { id } });
});

// 删除端口映射
portMappingRoutes.delete('/mappings/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  if (!portMappings.has(id)) return c.json({ code: 404, message: '映射不存在' }, 404);
  portMappings.delete(id);
  return c.json({ code: 0, message: '端口映射已删除' });
});

// 获取VLAN列表
portMappingRoutes.get('/vlans', authMiddleware, async (c) => {
  return c.json({ code: 0, data: Array.from(vlans.values()) });
});

// 创建VLAN
portMappingRoutes.post('/vlans', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  vlanId: z.number().min(1).max(4094),
  name: z.string(),
  description: z.string().optional(),
})), async (c) => {
  const data = c.req.valid('json');
  const id = `vlan-${data.vlanId}`;
  if (vlans.has(id)) return c.json({ code: 400, message: 'VLAN已存在' }, 400);
  vlans.set(id, { id, vlanId: data.vlanId, name: data.name, description: data.description || '', portCount: 0, createdAt: new Date() });
  return c.json({ code: 0, message: 'VLAN已创建', data: { id } });
});

// 删除VLAN
portMappingRoutes.delete('/vlans/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  if (!vlans.has(id)) return c.json({ code: 404, message: 'VLAN不存在' }, 404);
  vlans.delete(id);
  return c.json({ code: 0, message: 'VLAN已删除' });
});

// 端口状态统计
portMappingRoutes.get('/stats', authMiddleware, async (c) => {
  const mappings = Array.from(portMappings.values());
  const stats = {
    totalPorts: mappings.length,
    activePorts: mappings.filter(m => m.status === 'active').length,
    inactivePorts: mappings.filter(m => m.status === 'inactive').length,
    trunkPorts: mappings.filter(m => m.protocol === 'trunk').length,
    accessPorts: mappings.filter(m => m.protocol === 'access').length,
    vlanCount: vlans.size,
    speedDistribution: {
      '10G': mappings.filter(m => m.speed === '10G').length,
      '1G': mappings.filter(m => m.speed === '1G').length,
      '100M': mappings.filter(m => m.speed === '100M').length,
    },
  };
  return c.json({ code: 0, data: stats });
});

export { portMappingRoutes };
