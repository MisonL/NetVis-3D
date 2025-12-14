import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const workflowRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 工作流存储
const workflows = new Map<string, {
  id: string;
  name: string;
  description: string;
  steps: Array<{
    id: string;
    name: string;
    type: 'command' | 'script' | 'condition' | 'wait' | 'approval';
    config: Record<string, any>;
    nextOnSuccess?: string;
    nextOnFailure?: string;
    position: { x: number; y: number };
  }>;
  status: 'draft' | 'active' | 'archived';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}>();

// 工作流执行记录
const executions = new Map<string, {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep: string;
  startedAt: Date;
  completedAt?: Date;
  logs: Array<{ stepId: string; status: string; output: string; timestamp: Date }>;
  triggeredBy: string;
}>();

// 初始化示例工作流
const sampleWorkflow = {
  id: 'sample-1',
  name: '设备批量巡检',
  description: '自动执行设备健康检查和配置备份',
  steps: [
    { id: 's1', name: '获取设备列表', type: 'command' as const, config: { command: 'get_devices' }, nextOnSuccess: 's2', position: { x: 100, y: 100 } },
    { id: 's2', name: '检查设备状态', type: 'command' as const, config: { command: 'check_status' }, nextOnSuccess: 's3', nextOnFailure: 's4', position: { x: 300, y: 100 } },
    { id: 's3', name: '备份配置', type: 'command' as const, config: { command: 'backup_config' }, nextOnSuccess: 's5', position: { x: 500, y: 50 } },
    { id: 's4', name: '发送告警', type: 'command' as const, config: { command: 'send_alert' }, position: { x: 500, y: 150 } },
    { id: 's5', name: '生成报告', type: 'command' as const, config: { command: 'generate_report' }, position: { x: 700, y: 100 } },
  ],
  status: 'active' as const,
  createdBy: 'system',
  createdAt: new Date(),
  updatedAt: new Date(),
};
workflows.set(sampleWorkflow.id, sampleWorkflow);

// 获取工作流列表
workflowRoutes.get('/', authMiddleware, async (c) => {
  const status = c.req.query('status');
  
  let list = Array.from(workflows.values());
  if (status) {
    list = list.filter(w => w.status === status);
  }

  return c.json({
    code: 0,
    data: list.map(w => ({
      id: w.id,
      name: w.name,
      description: w.description,
      stepCount: w.steps.length,
      status: w.status,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    })),
  });
});

// 获取工作流详情
workflowRoutes.get('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const workflow = workflows.get(id);

  if (!workflow) {
    return c.json({ code: 404, message: '工作流不存在' }, 404);
  }

  return c.json({ code: 0, data: workflow });
});

// 创建工作流
workflowRoutes.post('/', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  steps: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['command', 'script', 'condition', 'wait', 'approval']),
    config: z.record(z.any()),
    nextOnSuccess: z.string().optional(),
    nextOnFailure: z.string().optional(),
    position: z.object({ x: z.number(), y: z.number() }),
  })).optional(),
})), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const id = crypto.randomUUID();
    workflows.set(id, {
      id,
      name: data.name,
      description: data.description || '',
      steps: data.steps || [],
      status: 'draft',
      createdBy: currentUser.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'create_workflow',
      resource: 'workflow',
      details: JSON.stringify({ workflowId: id, name: data.name }),
    });

    return c.json({ code: 0, message: '工作流创建成功', data: { id } });
  } catch (error) {
    return c.json({ code: 500, message: '创建失败' }, 500);
  }
});

// 更新工作流
workflowRoutes.put('/:id', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  steps: z.array(z.any()).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
})), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  try {
    const workflow = workflows.get(id);
    if (!workflow) {
      return c.json({ code: 404, message: '工作流不存在' }, 404);
    }

    if (data.name) workflow.name = data.name;
    if (data.description !== undefined) workflow.description = data.description;
    if (data.steps) workflow.steps = data.steps;
    if (data.status) workflow.status = data.status;
    workflow.updatedAt = new Date();

    return c.json({ code: 0, message: '工作流更新成功' });
  } catch (error) {
    return c.json({ code: 500, message: '更新失败' }, 500);
  }
});

// 执行工作流
workflowRoutes.post('/:id/execute', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  deviceIds: z.array(z.string()).optional(),
  variables: z.record(z.string()).optional(),
})), async (c) => {
  const id = c.req.param('id');
  const { deviceIds, variables } = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const workflow = workflows.get(id);
    if (!workflow) {
      return c.json({ code: 404, message: '工作流不存在' }, 404);
    }

    if (workflow.status !== 'active') {
      return c.json({ code: 400, message: '工作流未激活' }, 400);
    }

    const executionId = crypto.randomUUID();
    executions.set(executionId, {
      id: executionId,
      workflowId: id,
      workflowName: workflow.name,
      status: 'running',
      currentStep: workflow.steps[0]?.id || '',
      startedAt: new Date(),
      logs: [],
      triggeredBy: currentUser.userId,
    });

    // 模拟异步执行
    setTimeout(() => {
      const exec = executions.get(executionId);
      if (exec) {
        exec.status = 'completed';
        exec.completedAt = new Date();
        workflow.steps.forEach(step => {
          exec.logs.push({
            stepId: step.id,
            status: 'success',
            output: `步骤 ${step.name} 执行成功`,
            timestamp: new Date(),
          });
        });
      }
    }, 3000);

    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'execute_workflow',
      resource: 'workflow',
      details: JSON.stringify({ workflowId: id, executionId }),
    });

    return c.json({
      code: 0,
      message: '工作流已开始执行',
      data: { executionId },
    });
  } catch (error) {
    return c.json({ code: 500, message: '执行失败' }, 500);
  }
});

// 获取执行记录
workflowRoutes.get('/executions/list', authMiddleware, async (c) => {
  const list = Array.from(executions.values()).sort((a, b) => 
    b.startedAt.getTime() - a.startedAt.getTime()
  );

  return c.json({ code: 0, data: list });
});

// 获取执行详情
workflowRoutes.get('/executions/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const execution = executions.get(id);

  if (!execution) {
    return c.json({ code: 404, message: '执行记录不存在' }, 404);
  }

  return c.json({ code: 0, data: execution });
});

// 取消执行
workflowRoutes.post('/executions/:id/cancel', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');

  try {
    const execution = executions.get(id);
    if (!execution) {
      return c.json({ code: 404, message: '执行记录不存在' }, 404);
    }

    if (execution.status !== 'running') {
      return c.json({ code: 400, message: '只能取消运行中的任务' }, 400);
    }

    execution.status = 'cancelled';
    execution.completedAt = new Date();

    return c.json({ code: 0, message: '执行已取消' });
  } catch (error) {
    return c.json({ code: 500, message: '取消失败' }, 500);
  }
});

// 获取步骤模板
workflowRoutes.get('/templates/steps', authMiddleware, async (c) => {
  const templates = [
    { type: 'command', name: 'SSH命令', icon: 'code', description: '在设备上执行SSH命令' },
    { type: 'script', name: '脚本执行', icon: 'file-text', description: '执行批量脚本' },
    { type: 'condition', name: '条件判断', icon: 'fork', description: '根据条件分支执行' },
    { type: 'wait', name: '等待', icon: 'clock', description: '等待指定时间' },
    { type: 'approval', name: '审批', icon: 'check-circle', description: '等待人工审批' },
    { type: 'notify', name: '通知', icon: 'bell', description: '发送通知消息' },
    { type: 'backup', name: '配置备份', icon: 'save', description: '备份设备配置' },
    { type: 'health', name: '健康检查', icon: 'heart', description: '检查设备健康状态' },
  ];

  return c.json({ code: 0, data: templates });
});

export { workflowRoutes };
