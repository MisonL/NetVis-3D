import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { desc, sql } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';
import * as fs from 'fs';
import * as path from 'path';

const backupRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 备份目录
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';

// 确保备份目录存在
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// 备份记录（实际应存储在数据库）
const backupRecords = new Map<string, {
  id: string;
  name: string;
  type: 'full' | 'config' | 'data';
  size: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  filePath?: string;
  createdAt: Date;
  completedAt?: Date;
  createdBy: string;
  error?: string;
}>();

// 获取备份列表
backupRoutes.get('/list', authMiddleware, requireRole('admin'), async (c) => {
  try {
    const backups = Array.from(backupRecords.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return c.json({
      code: 0,
      data: backups,
    });
  } catch (error) {
    console.error('Get backups error:', error);
    return c.json({ code: 500, message: '获取备份列表失败' }, 500);
  }
});

// 创建备份
const createBackupSchema = z.object({
  name: z.string().min(1, '备份名称不能为空'),
  type: z.enum(['full', 'config', 'data']),
  description: z.string().optional(),
});

backupRoutes.post('/create', authMiddleware, requireRole('admin'), zValidator('json', createBackupSchema), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup_${data.type}_${timestamp}.json`;

    const record = {
      id,
      name: data.name,
      type: data.type,
      size: 0,
      status: 'running' as const,
      createdAt: new Date(),
      createdBy: currentUser.userId,
    };

    backupRecords.set(id, record);

    // 异步执行备份
    (async () => {
      try {
        const backupData: Record<string, unknown> = {
          metadata: {
            id,
            name: data.name,
            type: data.type,
            createdAt: new Date().toISOString(),
            version: '1.0.0',
          },
        };

        // 根据类型备份数据
        if (data.type === 'full' || data.type === 'data') {
          backupData.devices = await db.select().from(schema.devices);
          backupData.users = await db.select().from(schema.users);
          backupData.alerts = await db.select().from(schema.alerts);
          backupData.alertRules = await db.select().from(schema.alertRules);
        }

        if (data.type === 'full' || data.type === 'config') {
          backupData.configBackups = await db.select().from(schema.configBackups);
          backupData.configTemplates = await db.select().from(schema.configTemplates);
          backupData.notificationChannels = await db.select().from(schema.notificationChannels);
        }

        const content = JSON.stringify(backupData, null, 2);
        const filePath = path.join(BACKUP_DIR, fileName);
        
        fs.writeFileSync(filePath, content);

        const stats = fs.statSync(filePath);
        
        const updatedRecord = backupRecords.get(id);
        if (updatedRecord) {
          updatedRecord.status = 'completed';
          updatedRecord.size = stats.size;
          updatedRecord.filePath = filePath;
          updatedRecord.completedAt = new Date();
        }

        console.log(`Backup completed: ${id}`);
      } catch (err) {
        const failedRecord = backupRecords.get(id);
        if (failedRecord) {
          failedRecord.status = 'failed';
          failedRecord.error = String(err);
        }
        console.error('Backup failed:', err);
      }
    })();

    // 审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'create',
      resource: 'backups',
      resourceId: id,
      details: JSON.stringify({ name: data.name, type: data.type }),
    });

    return c.json({
      code: 0,
      message: '备份任务已创建',
      data: { id },
    });
  } catch (error) {
    console.error('Create backup error:', error);
    return c.json({ code: 500, message: '创建备份失败' }, 500);
  }
});

// 下载备份
backupRoutes.get('/download/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');

  try {
    const record = backupRecords.get(id);
    if (!record || !record.filePath) {
      return c.json({ code: 404, message: '备份不存在' }, 404);
    }

    if (record.status !== 'completed') {
      return c.json({ code: 400, message: '备份尚未完成' }, 400);
    }

    const content = fs.readFileSync(record.filePath);
    
    return new Response(content, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${path.basename(record.filePath)}"`,
      },
    });
  } catch (error) {
    console.error('Download backup error:', error);
    return c.json({ code: 500, message: '下载备份失败' }, 500);
  }
});

// 恢复备份
backupRoutes.post('/restore/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const currentUser = c.get('user');

  try {
    const record = backupRecords.get(id);
    if (!record || !record.filePath) {
      return c.json({ code: 404, message: '备份不存在' }, 404);
    }

    if (record.status !== 'completed') {
      return c.json({ code: 400, message: '备份尚未完成' }, 400);
    }

    // 读取备份文件
    const content = fs.readFileSync(record.filePath, 'utf-8');
    const backupData = JSON.parse(content);

    // 这里仅记录恢复操作，实际恢复需要谨慎处理
    console.log(`Restore requested for backup: ${id}`);

    // 审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'restore',
      resource: 'backups',
      resourceId: id,
      details: JSON.stringify({ name: record.name }),
    });

    return c.json({
      code: 0,
      message: '恢复操作已记录，请联系管理员执行实际恢复',
    });
  } catch (error) {
    console.error('Restore backup error:', error);
    return c.json({ code: 500, message: '恢复备份失败' }, 500);
  }
});

// 删除备份
backupRoutes.delete('/:id', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const currentUser = c.get('user');

  try {
    const record = backupRecords.get(id);
    if (!record) {
      return c.json({ code: 404, message: '备份不存在' }, 404);
    }

    // 删除文件
    if (record.filePath && fs.existsSync(record.filePath)) {
      fs.unlinkSync(record.filePath);
    }

    backupRecords.delete(id);

    // 审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'delete',
      resource: 'backups',
      resourceId: id,
    });

    return c.json({ code: 0, message: '备份删除成功' });
  } catch (error) {
    console.error('Delete backup error:', error);
    return c.json({ code: 500, message: '删除备份失败' }, 500);
  }
});

// 获取系统存储信息
backupRoutes.get('/storage', authMiddleware, requireRole('admin'), async (c) => {
  try {
    let totalSize = 0;
    const files: { name: string; size: number; createdAt: Date }[] = [];

    if (fs.existsSync(BACKUP_DIR)) {
      const items = fs.readdirSync(BACKUP_DIR);
      for (const item of items) {
        const filePath = path.join(BACKUP_DIR, item);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          totalSize += stats.size;
          files.push({
            name: item,
            size: stats.size,
            createdAt: stats.birthtime,
          });
        }
      }
    }

    return c.json({
      code: 0,
      data: {
        backupDir: BACKUP_DIR,
        totalSize,
        fileCount: files.length,
        files: files.slice(0, 20), // 最多返回20个
      },
    });
  } catch (error) {
    console.error('Get storage info error:', error);
    return c.json({ code: 500, message: '获取存储信息失败' }, 500);
  }
});

export { backupRoutes };
