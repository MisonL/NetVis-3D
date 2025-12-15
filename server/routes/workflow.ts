import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const workflowRoutes = new Hono<{ Variables: { user: JwtPayload } }>();

// 工作流存储
const workflows = new Map<string, {
  id: string;
  name: string;
  description: string;
  trigger: { type: 'manual' | 'scheduled' | 'event'; config: Record<string, string> };
  steps: { id: string; name: string; type: string; config: Record<string, string> }[];
  enabled: boolean;
  runCount: number;
  lastRun?: Date;
  createdAt: Date;
}>();

// 工作流执行历史
const workflowRuns: {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  steps: { stepId: string; status: string; output?: string }[];
}[] = [];

// 初始化示例工作流
[
  {
    id: 'wf-1',
    name: '设备巡检',
    description: '每日自动巡检所有设备',
    trigger: { type: 'scheduled' as const, config: { cron: '0 8 * * *' } as Record<string, string> },
    steps: [
      { id: 's1', name: '获取设备列表', type: 'api', config: { endpoint: '/devices' } as Record<string, string> },
      { id: 's2', name: '检查设备状态', type: 'script', config: { script: 'check_status.sh' } as Record<string, string> },
      { id: 's3', name: '发送报告', type: 'notification', config: { channel: 'email' } as Record<string, string> },
    ],
    enabled: true,
    runCount: 156,
  },
  {
    id: 'wf-2',
    name: '告警处理',
    description: '告警触发时自动执行',
    trigger: { type: 'event' as const, config: { event: 'alert.triggered' } as Record<string, string> },
    steps: [
      { id: 's1', name: '获取告警详情', type: 'api', config: {} as Record<string, string> },
      { id: 's2', name: '判断严重级别', type: 'condition', config: {} as Record<string, string> },
      { id: 's3', name: '通知值班人员', type: 'notification', config: {} as Record<string, string> },
    ],
    enabled: true,
    runCount: 89,
  },
].forEach(wf => workflows.set(wf.id, { ...wf, lastRun: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), createdAt: new Date() }));

// 获取工作流列表
workflowRoutes.get('/', authMiddleware, async (c) => {
  return c.json({ code: 0, data: Array.from(workflows.values()) });
});

// 获取工作流详情
workflowRoutes.get('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const workflow = workflows.get(id);
  if (!workflow) return c.json({ code: 404, message: '工作流不存在' }, 404);
  return c.json({ code: 0, data: workflow });
});

// 创建工作流
workflowRoutes.post('/', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  name: z.string(),
  description: z.string().optional(),
  trigger: z.object({ type: z.string(), config: z.record(z.string(), z.string()) }),
  steps: z.array(z.object({ name: z.string(), type: z.string(), config: z.record(z.string(), z.string()) })),
})), async (c) => {
  const data = c.req.valid('json');
  const id = crypto.randomUUID();
  const steps = data.steps.map((s, i) => ({ ...s, id: `s${i + 1}` }));
  workflows.set(id, { id, ...data, description: data.description || '', trigger: data.trigger as any, steps, enabled: true, runCount: 0, createdAt: new Date() });
  return c.json({ code: 0, message: '工作流已创建', data: { id } });
});

// 删除工作流
workflowRoutes.delete('/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  if (!workflows.has(id)) return c.json({ code: 404, message: '工作流不存在' }, 404);
  workflows.delete(id);
  return c.json({ code: 0, message: '工作流已删除' });
});

// 启用/禁用工作流
workflowRoutes.post('/:id/toggle', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const workflow = workflows.get(id);
  if (!workflow) return c.json({ code: 404, message: '工作流不存在' }, 404);
  workflow.enabled = !workflow.enabled;
  return c.json({ code: 0, message: workflow.enabled ? '已启用' : '已禁用' });
});

// 手动执行工作流
workflowRoutes.post('/:id/run', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const workflow = workflows.get(id);
  if (!workflow) return c.json({ code: 404, message: '工作流不存在' }, 404);
  
  const runId = crypto.randomUUID();
  const run = {
    id: runId,
    workflowId: id,
    status: 'completed' as const,
    startTime: new Date(),
    endTime: new Date(),
    steps: workflow.steps.map(s => ({ stepId: s.id, status: 'success', output: '执行成功' })),
  };
  workflowRuns.push(run);
  workflow.runCount++;
  workflow.lastRun = new Date();
  
  return c.json({ code: 0, message: '工作流已执行', data: run });
});

// 获取执行历史
workflowRoutes.get('/:id/history', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const runs = workflowRuns.filter(r => r.workflowId === id).reverse().slice(0, 20);
  return c.json({ code: 0, data: runs });
});

// 工作流统计
workflowRoutes.get('/stats/overview', authMiddleware, async (c) => {
  const wfs = Array.from(workflows.values());
  return c.json({
    code: 0,
    data: {
      total: wfs.length,
      enabled: wfs.filter(w => w.enabled).length,
      totalRuns: wfs.reduce((s, w) => s + w.runCount, 0),
      byTrigger: {
        manual: wfs.filter(w => w.trigger.type === 'manual').length,
        scheduled: wfs.filter(w => w.trigger.type === 'scheduled').length,
        event: wfs.filter(w => w.trigger.type === 'event').length,
      },
    },
  });
});

export { workflowRoutes };
