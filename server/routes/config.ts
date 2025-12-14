import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc, and, count } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';
import crypto from 'crypto';

const configRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 配置备份Schema
const backupSchema = z.object({
  deviceId: z.string().uuid('设备ID无效'),
  type: z.enum(['running', 'startup', 'full']).default('running'),
  description: z.string().optional(),
});

// 配置下发Schema
const deploySchema = z.object({
  deviceId: z.string().uuid('设备ID无效'),
  configContent: z.string().min(1, '配置内容不能为空'),
  description: z.string().optional(),
});

// 获取配置备份列表
configRoutes.get('/backups', authMiddleware, async (c) => {
  try {
    const deviceId = c.req.query('deviceId');
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    // 构建查询条件
    const whereConditions = deviceId 
      ? eq(schema.configBackups.deviceId, deviceId)
      : undefined;

    // 查询配置备份
    const backups = await db
      .select({
        id: schema.configBackups.id,
        deviceId: schema.configBackups.deviceId,
        deviceName: schema.devices.name,
        type: schema.configBackups.type,
        version: schema.configBackups.version,
        size: schema.configBackups.size,
        hash: schema.configBackups.hash,
        description: schema.configBackups.description,
        createdBy: schema.configBackups.createdBy,
        createdAt: schema.configBackups.createdAt,
      })
      .from(schema.configBackups)
      .leftJoin(schema.devices, eq(schema.configBackups.deviceId, schema.devices.id))
      .where(whereConditions)
      .orderBy(desc(schema.configBackups.createdAt))
      .limit(pageSize)
      .offset(offset);

    // 获取总数
    const totalResult = await db
      .select({ total: count() })
      .from(schema.configBackups)
      .where(whereConditions);
    const total = totalResult[0]?.total ?? 0;

    return c.json({
      code: 0,
      data: {
        list: backups,
        pagination: {
          page,
          pageSize,
          total,
        },
      },
    });
  } catch (error) {
    console.error('Get config backups error:', error);
    return c.json({ code: 500, message: '获取配置备份失败' }, 500);
  }
});

// 创建配置备份
configRoutes.post('/backups', authMiddleware, zValidator('json', backupSchema), async (c) => {
  const { deviceId, type, description } = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    // 检查设备是否存在
    const [device] = await db
      .select()
      .from(schema.devices)
      .where(eq(schema.devices.id, deviceId))
      .limit(1);

    if (!device) {
      return c.json({ code: 404, message: '设备不存在' }, 404);
    }

    // 模拟获取设备配置（实际应该SSH连接设备获取配置）
    const mockConfig = `! Configuration for ${device.name}
hostname ${device.name}
!
interface GigabitEthernet0/0
 ip address ${device.ipAddress || '192.168.1.1'} 255.255.255.0
 no shutdown
!
end`;

    const hash = crypto.createHash('md5').update(mockConfig).digest('hex');
    const version = `v${Date.now()}`;

    // 保存到数据库
    const [backup] = await db
      .insert(schema.configBackups)
      .values({
        deviceId,
        type,
        version,
        content: mockConfig,
        size: mockConfig.length,
        hash,
        description: description || '手动备份',
        createdBy: currentUser.userId,
      })
      .returning();

    // 记录审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'create',
      resource: 'config_backups',
      resourceId: backup?.id,
      details: JSON.stringify({ deviceName: device.name, type }),
    });

    return c.json({
      code: 0,
      message: '配置备份成功',
      data: {
        id: backup?.id,
        version: backup?.version,
        size: backup?.size,
        hash: backup?.hash,
      },
    });
  } catch (error) {
    console.error('Create config backup error:', error);
    return c.json({ code: 500, message: '配置备份失败' }, 500);
  }
});

// 获取配置备份内容
configRoutes.get('/backups/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');

  try {
    const [backup] = await db
      .select()
      .from(schema.configBackups)
      .where(eq(schema.configBackups.id, id))
      .limit(1);

    if (!backup) {
      return c.json({ code: 404, message: '配置备份不存在' }, 404);
    }

    return c.json({
      code: 0,
      data: {
        id: backup.id,
        content: backup.content,
        type: backup.type,
        version: backup.version,
        hash: backup.hash,
        size: backup.size,
        description: backup.description,
        createdAt: backup.createdAt,
      },
    });
  } catch (error) {
    console.error('Get config backup content error:', error);
    return c.json({ code: 500, message: '获取配置内容失败' }, 500);
  }
});

// 配置对比
configRoutes.post('/compare', authMiddleware, async (c) => {
  try {
    const { backupId1, backupId2 } = await c.req.json();

    // 模拟配置对比
    const diff = {
      added: [
        '+ interface GigabitEthernet0/2',
        '+  ip address 172.16.0.1 255.255.255.0',
        '+  no shutdown',
      ],
      removed: [
        '- ip route 10.0.0.0 255.0.0.0 192.168.1.100',
      ],
      modified: [
        '  hostname Router-01',
        '- hostname Router-Old',
        '+ hostname Router-New',
      ],
      unchanged: 85,
    };

    return c.json({
      code: 0,
      data: diff,
    });
  } catch (error) {
    console.error('Compare config error:', error);
    return c.json({ code: 500, message: '配置对比失败' }, 500);
  }
});

// 配置下发
configRoutes.post('/deploy', authMiddleware, requireRole('admin'), zValidator('json', deploySchema), async (c) => {
  const { deviceId, configContent, description } = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    // 检查设备是否存在
    const [device] = await db
      .select()
      .from(schema.devices)
      .where(eq(schema.devices.id, deviceId))
      .limit(1);

    if (!device) {
      return c.json({ code: 404, message: '设备不存在' }, 404);
    }

    const startTime = Date.now();

    // 创建下发记录
    const [deployment] = await db
      .insert(schema.configDeployments)
      .values({
        deviceId,
        content: configContent,
        status: 'running',
        description: description || '手动下发',
        deployedBy: currentUser.userId,
        startedAt: new Date(),
      })
      .returning();

    // 模拟配置下发（实际应该SSH连接设备下发配置）
    const linesApplied = configContent.split('\n').length;
    const duration = Date.now() - startTime + Math.floor(Math.random() * 2000);

    // 更新下发状态
    await db
      .update(schema.configDeployments)
      .set({
        status: 'success',
        linesApplied,
        duration,
        completedAt: new Date(),
      })
      .where(eq(schema.configDeployments.id, deployment!.id));

    // 记录审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'deploy',
      resource: 'config',
      resourceId: deployment?.id,
      details: JSON.stringify({ deviceName: device.name, linesApplied }),
    });

    return c.json({
      code: 0,
      message: '配置下发成功',
      data: {
        id: deployment?.id,
        status: 'success',
        linesApplied,
        duration,
      },
    });
  } catch (error) {
    console.error('Deploy config error:', error);
    return c.json({ code: 500, message: '配置下发失败' }, 500);
  }
});

// 获取配置下发历史
configRoutes.get('/deploy-history', authMiddleware, async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    const history = await db
      .select({
        id: schema.configDeployments.id,
        deviceId: schema.configDeployments.deviceId,
        deviceName: schema.devices.name,
        status: schema.configDeployments.status,
        linesApplied: schema.configDeployments.linesApplied,
        duration: schema.configDeployments.duration,
        error: schema.configDeployments.error,
        description: schema.configDeployments.description,
        deployedBy: schema.configDeployments.deployedBy,
        startedAt: schema.configDeployments.startedAt,
        completedAt: schema.configDeployments.completedAt,
      })
      .from(schema.configDeployments)
      .leftJoin(schema.devices, eq(schema.configDeployments.deviceId, schema.devices.id))
      .orderBy(desc(schema.configDeployments.createdAt))
      .limit(pageSize)
      .offset(offset);

    const totalResult = await db.select({ total: count() }).from(schema.configDeployments);
    const total = totalResult[0]?.total ?? 0;

    return c.json({
      code: 0,
      data: {
        list: history,
        pagination: { page, pageSize, total },
      },
    });
  } catch (error) {
    console.error('Get deploy history error:', error);
    return c.json({ code: 500, message: '获取下发历史失败' }, 500);
  }
});

// 配置模板列表
configRoutes.get('/templates', authMiddleware, async (c) => {
  try {
    const templates = await db
      .select({
        id: schema.configTemplates.id,
        name: schema.configTemplates.name,
        vendor: schema.configTemplates.vendor,
        type: schema.configTemplates.deviceType,
        description: schema.configTemplates.description,
        variables: schema.configTemplates.variables,
        isSystem: schema.configTemplates.isSystem,
        createdAt: schema.configTemplates.createdAt,
      })
      .from(schema.configTemplates)
      .orderBy(desc(schema.configTemplates.createdAt));

    return c.json({
      code: 0,
      data: templates,
    });
  } catch (error) {
    console.error('Get config templates error:', error);
    return c.json({ code: 500, message: '获取配置模板失败' }, 500);
  }
});

export { configRoutes };
