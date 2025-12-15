import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const dataCenterRoutes = new Hono<{ Variables: { user: JwtPayload } }>();

// 数据中心/机房
const dataCenters = new Map<string, {
  id: string;
  name: string;
  code: string;
  location: string;
  address: string;
  contact: string;
  phone: string;
  rackCount: number;
  deviceCount: number;
  status: 'active' | 'maintenance' | 'inactive';
  createdAt: Date;
}>();

// 机柜
const racks = new Map<string, {
  id: string;
  dataCenterId: string;
  name: string;
  row: string;
  column: string;
  uCount: number;
  usedU: number;
  power: number;
  maxPower: number;
  createdAt: Date;
}>();

// 初始化示例数据
[
  { id: 'dc-1', name: '主数据中心', code: 'DC-01', location: '北京', address: '北京市海淀区', contact: '张三', phone: '13800138000', rackCount: 50, deviceCount: 500, status: 'active' as const },
  { id: 'dc-2', name: '灾备数据中心', code: 'DC-02', location: '上海', address: '上海市浦东新区', contact: '李四', phone: '13900139000', rackCount: 30, deviceCount: 200, status: 'active' as const },
].forEach(dc => dataCenters.set(dc.id, { ...dc, createdAt: new Date() }));

[
  { id: 'rack-1', dataCenterId: 'dc-1', name: 'A01', row: 'A', column: '01', uCount: 42, usedU: 35, power: 8000, maxPower: 10000 },
  { id: 'rack-2', dataCenterId: 'dc-1', name: 'A02', row: 'A', column: '02', uCount: 42, usedU: 28, power: 6500, maxPower: 10000 },
  { id: 'rack-3', dataCenterId: 'dc-1', name: 'B01', row: 'B', column: '01', uCount: 42, usedU: 40, power: 9200, maxPower: 10000 },
].forEach(r => racks.set(r.id, { ...r, createdAt: new Date() }));

// 获取数据中心列表
dataCenterRoutes.get('/', authMiddleware, async (c) => {
  return c.json({ code: 0, data: Array.from(dataCenters.values()) });
});

// 获取数据中心详情
dataCenterRoutes.get('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const dc = dataCenters.get(id);
  if (!dc) return c.json({ code: 404, message: '数据中心不存在' }, 404);
  
  const dcRacks = Array.from(racks.values()).filter(r => r.dataCenterId === id);
  return c.json({ code: 0, data: { ...dc, racks: dcRacks } });
});

// 创建数据中心
dataCenterRoutes.post('/', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  name: z.string(),
  code: z.string(),
  location: z.string(),
  address: z.string().optional(),
  contact: z.string().optional(),
  phone: z.string().optional(),
})), async (c) => {
  const data = c.req.valid('json');
  const id = crypto.randomUUID();
  dataCenters.set(id, { id, ...data, address: data.address || '', contact: data.contact || '', phone: data.phone || '', rackCount: 0, deviceCount: 0, status: 'active', createdAt: new Date() });
  return c.json({ code: 0, message: '数据中心已创建', data: { id } });
});

// 删除数据中心
dataCenterRoutes.delete('/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  if (!dataCenters.has(id)) return c.json({ code: 404, message: '数据中心不存在' }, 404);
  dataCenters.delete(id);
  return c.json({ code: 0, message: '数据中心已删除' });
});

// 获取机柜列表
dataCenterRoutes.get('/:id/racks', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const dcRacks = Array.from(racks.values()).filter(r => r.dataCenterId === id);
  return c.json({ code: 0, data: dcRacks });
});

// 创建机柜
dataCenterRoutes.post('/:id/racks', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  name: z.string(),
  row: z.string(),
  column: z.string(),
  uCount: z.number(),
  maxPower: z.number(),
})), async (c) => {
  const dataCenterId = c.req.param('id');
  const data = c.req.valid('json');
  const id = crypto.randomUUID();
  racks.set(id, { id, dataCenterId, ...data, usedU: 0, power: 0, createdAt: new Date() });
  
  const dc = dataCenters.get(dataCenterId);
  if (dc) dc.rackCount++;
  
  return c.json({ code: 0, message: '机柜已创建', data: { id } });
});

// 数据中心统计
dataCenterRoutes.get('/stats/overview', authMiddleware, async (c) => {
  const dcs = Array.from(dataCenters.values());
  const allRacks = Array.from(racks.values());
  return c.json({
    code: 0,
    data: {
      totalDataCenters: dcs.length,
      totalRacks: allRacks.length,
      totalDevices: dcs.reduce((s, d) => s + d.deviceCount, 0),
      totalU: allRacks.reduce((s, r) => s + r.uCount, 0),
      usedU: allRacks.reduce((s, r) => s + r.usedU, 0),
      avgUtilization: (allRacks.reduce((s, r) => s + r.usedU / r.uCount, 0) / allRacks.length * 100).toFixed(1) + '%',
    },
  });
});

export { dataCenterRoutes };
