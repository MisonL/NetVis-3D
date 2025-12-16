import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc, sql } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const cmdbRoutes = new Hono<{ Variables: { user: JwtPayload } }>();

// CMDB资产类型
const assetTypes = new Map([
  ['server', { id: 'server', name: '服务器', icon: 'CloudServerOutlined', count: 45 }],
  ['network', { id: 'network', name: '网络设备', icon: 'WifiOutlined', count: 150 }],
  ['storage', { id: 'storage', name: '存储设备', icon: 'DatabaseOutlined', count: 20 }],
  ['security', { id: 'security', name: '安全设备', icon: 'SafetyOutlined', count: 15 }],
]);

// CMDB资产属性模板
const attributeTemplates = new Map([
  ['server', ['cpu', 'memory', 'disk', 'os', 'kernel']],
  ['network', ['ports', 'ios_version', 'uptime', 'cpu_usage']],
  ['storage', ['capacity', 'used', 'raid_level', 'protocol']],
]);

// 资产关系
const assetRelations: { sourceId: string; targetId: string; type: string }[] = [];

// 获取资产类型列表
cmdbRoutes.get('/types', authMiddleware, async (c) => {
  return c.json({ code: 0, data: Array.from(assetTypes.values()) });
});

// 获取资产列表（增强）
cmdbRoutes.get('/assets', authMiddleware, async (c) => {
  const type = c.req.query('type');
  const devices = await db.select().from(schema.devices);
  
  // 获取每个设备的最新指标
  const metricsResult = await db.execute(sql`
    SELECT DISTINCT ON (device_id) 
      device_id, cpu_usage, memory_usage
    FROM ${schema.deviceMetrics}
    ORDER BY device_id, timestamp DESC
  `);
  
  // @ts-ignore
  const metricsRows = metricsResult.rows || metricsResult;
  const metricsMap = new Map();
  metricsRows.forEach((r: any) => metricsMap.set(r.device_id, r));
  
  const assets = devices.map(d => {
    const m = metricsMap.get(d.id);
    return {
      id: d.id,
      name: d.name,
      type: d.type || 'network',
      ip: d.ipAddress,
      status: d.status,
      vendor: d.vendor,
      model: d.model,
      location: d.location,
      attributes: { 
        cpu: m ? `${Math.round(Number(m.cpu_usage))}%` : 'N/A', 
        memory: m ? `${Math.round(Number(m.memory_usage))}%` : 'N/A',
        uptime: 'UNKNOWN' 
      },
    };
  });

  return c.json({ code: 0, data: type ? assets.filter(a => a.type === type) : assets });
});

// 获取资产详情
cmdbRoutes.get('/assets/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const [device] = await db.select().from(schema.devices).where(eq(schema.devices.id, id));
  
  if (!device) return c.json({ code: 404, message: '资产不存在' }, 404);
  
  return c.json({
    code: 0,
    data: {
      ...device,
      attributes: {
        cpu: '4 Cores',
        memory: '16GB',
        os: 'Linux',
        uptime: '45d 12h',
      },
      relations: assetRelations.filter(r => r.sourceId === id || r.targetId === id),
    },
  });
});

// 添加资产关系
cmdbRoutes.post('/relations', authMiddleware, zValidator('json', z.object({
  sourceId: z.string(),
  targetId: z.string(),
  type: z.string(),
})), async (c) => {
  const data = c.req.valid('json');
  assetRelations.push(data);
  return c.json({ code: 0, message: '关系已添加' });
});

// 获取关系图数据
cmdbRoutes.get('/graph', authMiddleware, async (c) => {
  const devices = await db.select().from(schema.devices).limit(20);
  
  const nodes = devices.map(d => ({ id: d.id, name: d.name, type: d.type }));
  const edges = assetRelations.slice(0, 30);
  
  return c.json({ code: 0, data: { nodes, edges } });
});

// CMDB统计
cmdbRoutes.get('/stats', authMiddleware, async (c) => {
  const devices = await db.select().from(schema.devices);
  return c.json({
    code: 0,
    data: {
      totalAssets: devices.length,
      byType: Array.from(assetTypes.values()),
      relations: assetRelations.length,
      lastSync: new Date(),
    },
  });
});

export { cmdbRoutes };
