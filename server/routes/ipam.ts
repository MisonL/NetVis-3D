import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const ipamRoutes = new Hono<{ Variables: { user: JwtPayload } }>();

// IP子网存储
const subnets = new Map<string, {
  id: string;
  network: string;
  cidr: number;
  gateway: string;
  vlan: number;
  name: string;
  description: string;
  totalIps: number;
  usedIps: number;
  createdAt: Date;
}>();

// IP地址分配
const ipAllocations = new Map<string, {
  id: string;
  ip: string;
  subnetId: string;
  hostname: string;
  mac: string;
  status: 'available' | 'assigned' | 'reserved' | 'dhcp';
  assignedTo: string;
  lastSeen?: Date;
}>();

// 初始化示例数据
[
  { id: 'subnet-1', network: '192.168.1.0', cidr: 24, gateway: '192.168.1.1', vlan: 100, name: '办公网络', description: '办公区域', totalIps: 254, usedIps: 156 },
  { id: 'subnet-2', network: '192.168.2.0', cidr: 24, gateway: '192.168.2.1', vlan: 200, name: '服务器网络', description: '服务器区域', totalIps: 254, usedIps: 45 },
  { id: 'subnet-3', network: '10.0.0.0', cidr: 16, gateway: '10.0.0.1', vlan: 300, name: '数据中心', description: '核心数据中心', totalIps: 65534, usedIps: 12500 },
].forEach(s => subnets.set(s.id, { ...s, createdAt: new Date() }));

// 获取子网列表
ipamRoutes.get('/subnets', authMiddleware, async (c) => {
  return c.json({ code: 0, data: Array.from(subnets.values()) });
});

// 创建子网
ipamRoutes.post('/subnets', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  network: z.string(),
  cidr: z.number().min(8).max(30),
  gateway: z.string(),
  vlan: z.number().optional(),
  name: z.string(),
  description: z.string().optional(),
})), async (c) => {
  const data = c.req.valid('json');
  const id = crypto.randomUUID();
  const totalIps = Math.pow(2, 32 - data.cidr) - 2;
  subnets.set(id, { id, ...data, vlan: data.vlan || 0, description: data.description || '', totalIps, usedIps: 0, createdAt: new Date() });
  return c.json({ code: 0, message: '子网已创建', data: { id } });
});

// 获取子网详情
ipamRoutes.get('/subnets/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const subnet = subnets.get(id);
  if (!subnet) return c.json({ code: 404, message: '子网不存在' }, 404);
  
  // 获取该子网的IP分配
  const allocations = Array.from(ipAllocations.values()).filter(a => a.subnetId === id);
  
  return c.json({ code: 0, data: { ...subnet, allocations } });
});

// 删除子网
ipamRoutes.delete('/subnets/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  if (!subnets.has(id)) return c.json({ code: 404, message: '子网不存在' }, 404);
  subnets.delete(id);
  return c.json({ code: 0, message: '子网已删除' });
});

// 分配IP
ipamRoutes.post('/allocate', authMiddleware, zValidator('json', z.object({
  subnetId: z.string(),
  ip: z.string(),
  hostname: z.string(),
  mac: z.string().optional(),
  status: z.enum(['assigned', 'reserved', 'dhcp']),
  assignedTo: z.string().optional(),
})), async (c) => {
  const data = c.req.valid('json');
  const id = crypto.randomUUID();
  ipAllocations.set(id, { id, ...data, mac: data.mac || '', assignedTo: data.assignedTo || '' });
  
  const subnet = subnets.get(data.subnetId);
  if (subnet) subnet.usedIps++;
  
  return c.json({ code: 0, message: 'IP已分配', data: { id } });
});

// 释放IP
ipamRoutes.delete('/allocations/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const allocation = ipAllocations.get(id);
  if (!allocation) return c.json({ code: 404, message: 'IP分配不存在' }, 404);
  
  const subnet = subnets.get(allocation.subnetId);
  if (subnet) subnet.usedIps--;
  
  ipAllocations.delete(id);
  return c.json({ code: 0, message: 'IP已释放' });
});

// IP扫描
ipamRoutes.post('/scan', authMiddleware, zValidator('json', z.object({
  subnetId: z.string(),
})), async (c) => {
  const { subnetId } = c.req.valid('json');
  const subnet = subnets.get(subnetId);
  if (!subnet) return c.json({ code: 404, message: '子网不存在' }, 404);
  
  // 模拟扫描结果
  const discovered = Array.from({ length: 10 }, (_, i) => ({
    ip: `${subnet.network.replace('.0', '')}.${i + 10}`,
    mac: `00:1A:2B:${String(i).padStart(2, '0')}:CD:EF`,
    hostname: `host-${i + 1}`,
    vendor: ['Dell', 'HP', 'Cisco', 'Juniper'][i % 4],
    status: Math.random() > 0.3 ? 'online' : 'offline',
  }));
  
  return c.json({ code: 0, data: { scanned: discovered.length, discovered } });
});

// IPAM统计
ipamRoutes.get('/stats', authMiddleware, async (c) => {
  const subnetList = Array.from(subnets.values());
  const stats = {
    totalSubnets: subnetList.length,
    totalIps: subnetList.reduce((sum, s) => sum + s.totalIps, 0),
    usedIps: subnetList.reduce((sum, s) => sum + s.usedIps, 0),
    utilizationRate: '35.2%',
    topUtilized: subnetList.sort((a, b) => (b.usedIps / b.totalIps) - (a.usedIps / a.totalIps)).slice(0, 5),
  };
  return c.json({ code: 0, data: stats });
});

export { ipamRoutes };
