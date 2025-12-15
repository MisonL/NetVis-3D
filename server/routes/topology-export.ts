import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const topologyExportRoutes = new Hono<{ Variables: { user: JwtPayload } }>();

// 导出记录
const exportHistory: {
  id: string;
  format: 'svg' | 'png' | 'json' | 'visio';
  fileName: string;
  fileSize: number;
  createdBy: string;
  createdAt: Date;
}[] = [];

// 导出为JSON
topologyExportRoutes.get('/json', authMiddleware, async (c) => {
  const topology = {
    nodes: [
      { id: 'Core-SW1', type: 'switch', label: '核心交换机1', x: 400, y: 100 },
      { id: 'Agg-SW1', type: 'switch', label: '汇聚交换机1', x: 200, y: 250 },
      { id: 'Agg-SW2', type: 'switch', label: '汇聚交换机2', x: 600, y: 250 },
      { id: 'Acc-SW1', type: 'switch', label: '接入交换机1', x: 100, y: 400 },
      { id: 'Router-1', type: 'router', label: '核心路由器', x: 400, y: 50 },
    ],
    edges: [
      { source: 'Router-1', target: 'Core-SW1', bandwidth: '10G' },
      { source: 'Core-SW1', target: 'Agg-SW1', bandwidth: '10G' },
      { source: 'Core-SW1', target: 'Agg-SW2', bandwidth: '10G' },
      { source: 'Agg-SW1', target: 'Acc-SW1', bandwidth: '1G' },
    ],
    metadata: {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      deviceCount: 5,
      linkCount: 4,
    },
  };
  
  return c.json({ code: 0, data: topology });
});

// 导出为SVG
topologyExportRoutes.get('/svg', authMiddleware, async (c) => {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
  <rect width="800" height="600" fill="#f5f5f5"/>
  <circle cx="400" cy="100" r="30" fill="#1890ff"/>
  <text x="400" y="105" text-anchor="middle" fill="white">核心</text>
  <circle cx="200" cy="250" r="25" fill="#52c41a"/>
  <text x="200" y="255" text-anchor="middle" fill="white">汇聚1</text>
  <circle cx="600" cy="250" r="25" fill="#52c41a"/>
  <text x="600" y="255" text-anchor="middle" fill="white">汇聚2</text>
  <line x1="400" y1="130" x2="200" y2="225" stroke="#666" stroke-width="2"/>
  <line x1="400" y1="130" x2="600" y2="225" stroke="#666" stroke-width="2"/>
</svg>`;
  
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } });
});

// 创建导出任务
topologyExportRoutes.post('/create', authMiddleware, zValidator('json', z.object({
  format: z.enum(['svg', 'png', 'json', 'visio']),
  options: z.object({
    includeLabels: z.boolean().optional(),
    includeLinks: z.boolean().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  }).optional(),
})), async (c) => {
  const { format } = c.req.valid('json');
  const currentUser = c.get('user');
  
  const id = crypto.randomUUID();
  const record = {
    id,
    format,
    fileName: `topology_${Date.now()}.${format}`,
    fileSize: Math.floor(Math.random() * 500000 + 10000),
    createdBy: currentUser.userId,
    createdAt: new Date(),
  };
  exportHistory.push(record);
  
  return c.json({ code: 0, message: '导出任务已创建', data: record });
});

// 获取导出历史
topologyExportRoutes.get('/history', authMiddleware, async (c) => {
  return c.json({ code: 0, data: [...exportHistory].reverse().slice(0, 20) });
});

// 导出统计
topologyExportRoutes.get('/stats', authMiddleware, async (c) => {
  return c.json({
    code: 0,
    data: {
      total: exportHistory.length,
      byFormat: {
        svg: exportHistory.filter(e => e.format === 'svg').length,
        png: exportHistory.filter(e => e.format === 'png').length,
        json: exportHistory.filter(e => e.format === 'json').length,
        visio: exportHistory.filter(e => e.format === 'visio').length,
      },
    },
  });
});

export { topologyExportRoutes };
