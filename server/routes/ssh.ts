import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const sshRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// SSH凭据存储（生产环境应加密存储）
const sshCredentials = new Map<string, {
  id: string;
  name: string;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  port: number;
  deviceIds: string[];
  createdAt: Date;
  updatedAt: Date;
}>();

// SSH会话记录
const sshSessions: Array<{
  id: string;
  deviceId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  commands: Array<{ command: string; output: string; timestamp: Date }>;
  status: 'active' | 'closed';
}> = [];

// 命令模板
const commandTemplates = new Map<string, {
  id: string;
  name: string;
  vendor: string;
  commands: string[];
  description?: string;
}>();

// 初始化默认命令模板
const defaultTemplates = [
  { id: '1', name: '查看版本', vendor: 'cisco', commands: ['show version'], description: 'Cisco设备版本信息' },
  { id: '2', name: '查看接口', vendor: 'cisco', commands: ['show ip interface brief'], description: 'Cisco接口状态' },
  { id: '3', name: '查看路由', vendor: 'cisco', commands: ['show ip route'], description: 'Cisco路由表' },
  { id: '4', name: '查看版本', vendor: 'huawei', commands: ['display version'], description: '华为设备版本' },
  { id: '5', name: '查看接口', vendor: 'huawei', commands: ['display interface brief'], description: '华为接口状态' },
];

defaultTemplates.forEach(t => commandTemplates.set(t.id, t));

// 凭据Schema
const credentialSchema = z.object({
  name: z.string().min(1, '凭据名称不能为空'),
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().optional(),
  privateKey: z.string().optional(),
  passphrase: z.string().optional(),
  port: z.number().int().min(1).max(65535).default(22),
  deviceIds: z.array(z.string()).optional(),
});

// 获取凭据列表
sshRoutes.get('/credentials', authMiddleware, requireRole('admin'), async (c) => {
  try {
    const credentials = Array.from(sshCredentials.values()).map(cred => ({
      ...cred,
      password: cred.password ? '******' : undefined,
      privateKey: cred.privateKey ? '******' : undefined,
    }));

    return c.json({ code: 0, data: credentials });
  } catch (error) {
    return c.json({ code: 500, message: '获取凭据列表失败' }, 500);
  }
});

// 创建凭据
sshRoutes.post('/credentials', authMiddleware, requireRole('admin'), zValidator('json', credentialSchema), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const id = crypto.randomUUID();

    const credential = {
      id,
      name: data.name,
      username: data.username,
      password: data.password,
      privateKey: data.privateKey,
      passphrase: data.passphrase,
      port: data.port,
      deviceIds: data.deviceIds || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    sshCredentials.set(id, credential);

    // 审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'create',
      resource: 'ssh_credentials',
      resourceId: id,
      details: JSON.stringify({ name: data.name }),
    });

    return c.json({ code: 0, message: '凭据创建成功', data: { id } });
  } catch (error) {
    return c.json({ code: 500, message: '创建凭据失败' }, 500);
  }
});

// 删除凭据
sshRoutes.delete('/credentials/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');

  try {
    if (!sshCredentials.has(id)) {
      return c.json({ code: 404, message: '凭据不存在' }, 404);
    }

    sshCredentials.delete(id);
    return c.json({ code: 0, message: '凭据删除成功' });
  } catch (error) {
    return c.json({ code: 500, message: '删除凭据失败' }, 500);
  }
});

// 执行SSH命令（真实SSH连接）
sshRoutes.post('/execute', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  deviceId: z.string().uuid(),
  commands: z.array(z.string()),
  credentialId: z.string().optional(),
})), async (c) => {
  const { deviceId, commands, credentialId } = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    // 获取设备信息
    const [device] = await db.select().from(schema.devices).where(eq(schema.devices.id, deviceId));
    if (!device) {
      return c.json({ code: 404, message: '设备不存在' }, 404);
    }

    if (!device.ipAddress) {
      return c.json({ code: 400, message: '设备IP地址未配置' }, 400);
    }

    // 获取凭据
    let username = 'admin';
    let password = 'admin';
    let port = 22;

    if (credentialId && sshCredentials.has(credentialId)) {
      const cred = sshCredentials.get(credentialId)!;
      username = cred.username;
      password = cred.password || '';
      port = cred.port;
    }

    // 导入SSH客户端
    const { executeSSHCommand } = await import('../utils/ssh-client');

    // 执行命令
    const results = [];
    for (const cmd of commands) {
      try {
        const result = await executeSSHCommand(
          { host: device.ipAddress, port, username, password },
          cmd
        );
        results.push({
          command: cmd,
          output: result.success ? (result.output || '') : (result.error || '未知错误'),
          timestamp: new Date(),
          success: result.success,
        });
      } catch (err) {
        results.push({
          command: cmd,
          output: `执行失败: ${err instanceof Error ? err.message : '未知错误'}`,
          timestamp: new Date(),
          success: false,
        });
      }
    }

    // 记录会话
    const sessionId = crypto.randomUUID();
    sshSessions.unshift({
      id: sessionId,
      deviceId,
      userId: currentUser.userId,
      startTime: new Date(),
      endTime: new Date(),
      commands: results,
      status: 'closed',
    });

    // 审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'ssh_execute',
      resource: 'devices',
      resourceId: deviceId,
      details: JSON.stringify({ commands, results: results.map(r => ({ cmd: r.command, success: r.success })) }),
    });

    return c.json({
      code: 0,
      message: '命令执行完成',
      data: { sessionId, results },
    });
  } catch (error) {
    console.error('SSH execute error:', error);
    return c.json({ code: 500, message: '命令执行失败' }, 500);
  }
});

// 获取命令模板
sshRoutes.get('/templates', authMiddleware, async (c) => {
  const vendor = c.req.query('vendor');

  try {
    let templates = Array.from(commandTemplates.values());
    if (vendor) {
      templates = templates.filter(t => t.vendor === vendor);
    }

    return c.json({ code: 0, data: templates });
  } catch (error) {
    return c.json({ code: 500, message: '获取模板失败' }, 500);
  }
});

// 获取SSH会话历史
sshRoutes.get('/sessions', authMiddleware, async (c) => {
  const deviceId = c.req.query('deviceId');
  const page = parseInt(c.req.query('page') || '1');
  const pageSize = parseInt(c.req.query('pageSize') || '20');

  try {
    let sessions = [...sshSessions];
    if (deviceId) {
      sessions = sessions.filter(s => s.deviceId === deviceId);
    }

    const total = sessions.length;
    const start = (page - 1) * pageSize;
    const data = sessions.slice(start, start + pageSize);

    return c.json({
      code: 0,
      data: { list: data, total, page, pageSize },
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取会话历史失败' }, 500);
  }
});

// 批量执行命令
sshRoutes.post('/batch-execute', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  deviceIds: z.array(z.string().uuid()),
  commands: z.array(z.string()),
})), async (c) => {
  const { deviceIds, commands } = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    // 导入SSH客户端
    const { executeSSHCommand } = await import('../utils/ssh-client');

    const results = await Promise.all(
      deviceIds.map(async (deviceId) => {
        const [device] = await db.select().from(schema.devices).where(eq(schema.devices.id, deviceId));
        if (!device) return { deviceId, success: false, error: '设备不存在' };
        if (!device.ipAddress) return { deviceId, success: false, error: '设备IP未配置' };

        // 执行每条命令
        const cmdResults = [];
        for (const cmd of commands) {
          try {
            const result = await executeSSHCommand(
              { host: device.ipAddress, username: 'admin', password: 'admin' },
              cmd
            );
            cmdResults.push({
              command: cmd,
              output: result.success ? (result.output || '') : (result.error || '未知错误'),
              success: result.success,
            });
          } catch (err) {
            cmdResults.push({
              command: cmd,
              output: `执行失败: ${err instanceof Error ? err.message : '未知错误'}`,
              success: false,
            });
          }
        }

        return {
          deviceId,
          deviceName: device.name,
          success: cmdResults.every(r => r.success),
          results: cmdResults,
        };
      })
    );

    // 审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'ssh_batch_execute',
      resource: 'devices',
      details: JSON.stringify({ deviceIds, commands }),
    });

    return c.json({
      code: 0,
      message: `已在 ${deviceIds.length} 台设备上执行命令`,
      data: results,
    });
  } catch (error) {
    return c.json({ code: 500, message: '批量执行失败' }, 500);
  }
});

export { sshRoutes };
