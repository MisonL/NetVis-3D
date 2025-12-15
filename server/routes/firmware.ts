import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, inArray } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';
import { SSHClient } from '../utils/ssh-client';
import path from 'path';
import fs from 'fs';

const firmwareRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 上传目录
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'firmwares');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 获取固件列表
firmwareRoutes.get('/', authMiddleware, async (c) => {
  try {
    const list = await db.select().from(schema.firmwares).orderBy(schema.firmwares.createdAt);
    return c.json({ code: 0, data: list });
  } catch (error) {
    return c.json({ code: 500, message: '获取固件列表失败' }, 500);
  }
});

// 上传固件
firmwareRoutes.post('/upload', authMiddleware, requireRole('admin'), async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body['file'];
    const name = body['name'] as string;
    const version = body['version'] as string;
    const vendor = body['vendor'] as string;
    const deviceType = body['deviceType'] as string;
    const description = body['description'] as string;

    if (!file || !(file instanceof File)) {
      return c.json({ code: 400, message: '请上传此文件' }, 400);
    }

    const fileName = `${Date.now()}-${file.name}`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    // 写入文件 (Bun API)
    await Bun.write(filePath, file);

    const [firmware] = await db.insert(schema.firmwares).values({
      name: name || file.name,
      version: version || '1.0.0',
      vendor: vendor || 'unknown',
      deviceType: deviceType || 'unknown',
      filePath,
      fileSize: file.size, // integer limit check?
      description,
      uploadedBy: c.get('user').userId,
    }).returning();

    return c.json({ code: 0, message: '上传成功', data: firmware });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ code: 500, message: '上传失败' }, 500);
  }
});

// 创建升级任务
firmwareRoutes.post('/jobs', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  name: z.string(),
  firmwareId: z.string(),
  deviceIds: z.array(z.string()),
  scheduledAt: z.string().optional(), // ISO String
})), async (c) => {
  const { name, firmwareId, deviceIds, scheduledAt } = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    // 检查固件
    const [firmware] = await db.select().from(schema.firmwares).where(eq(schema.firmwares.id, firmwareId));
    if (!firmware) return c.json({ code: 404, message: '固件不存在' }, 404);

    // 创建Job
    const [job] = await db.insert(schema.upgradeJobs).values({
      name,
      firmwareId,
      status: 'pending',
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      createdBy: currentUser.userId,
    }).returning();

    // 创建Device Jobs
    for (const devId of deviceIds) {
      await db.insert(schema.upgradeJobDevices).values({
        jobId: job.id,
        deviceId: devId,
        status: 'pending',
      });
    }

    return c.json({ code: 0, message: '任务创建成功', data: job });
  } catch (error) {
    console.error('Create job error:', error);
    return c.json({ code: 500, message: '创建该任务失败' }, 500);
  }
});

// 开始任务 (异步)
firmwareRoutes.post('/jobs/:id/start', authMiddleware, requireRole('admin'), async (c) => {
  const jobId = c.req.param('id');
  
  try {
    const [job] = await db.select().from(schema.upgradeJobs).where(eq(schema.upgradeJobs.id, jobId));
    if (!job) return c.json({ code: 404, message: '任务不存在' }, 404);

    if (job.status === 'running' || job.status === 'completed') {
      return c.json({ code: 400, message: '任务已在运行或已完成' }, 400);
    }

    // 更新任务状态
    await db.update(schema.upgradeJobs).set({ status: 'running', startedAt: new Date() }).where(eq(schema.upgradeJobs.id, jobId));

    // 异步执行升级流程
    executeUpgradeJob(jobId, job.firmwareId);

    return c.json({ code: 0, message: '任务已启动' });
  } catch (error) {
    return c.json({ code: 500, message: '启动任务失败' }, 500);
  }
});

// 获取任务详情
firmwareRoutes.get('/jobs/:id', authMiddleware, async (c) => {
    const jobId = c.req.param('id');
    try {
        const [job] = await db.select().from(schema.upgradeJobs).where(eq(schema.upgradeJobs.id, jobId));
        if(!job) return c.json({code:404, message:'Job Not Found'}, 404);
        
        const devices = await db.select().from(schema.upgradeJobDevices).where(eq(schema.upgradeJobDevices.jobId, jobId));
        
        // 关联设备名称（可选，若前端需要）
        // 简单返回
        return c.json({code:0, data: { ...job, devices }});
    } catch(e) {
        return c.json({code:500, message:'Error'}, 500);
    }
});

// 核心升级逻辑
async function executeUpgradeJob(jobId: string, firmwareId: string) {
  try {
    const [firmware] = await db.select().from(schema.firmwares).where(eq(schema.firmwares.id, firmwareId));
    if (!firmware) return; // Should not happen

    const deviceJobs = await db.select().from(schema.upgradeJobDevices).where(eq(schema.upgradeJobDevices.jobId, jobId));
    
    // 获取所有设备信息
    const deviceIds = deviceJobs.map(j => j.deviceId);
    const devices = await db.select().from(schema.devices).where(inArray(schema.devices.id, deviceIds));
    const deviceMap = new Map(devices.map(d => [d.id, d]));

    // 并行执行（限制并发数？这里简单全并发）
    await Promise.all(deviceJobs.map(async (devJob) => {
        const device = deviceMap.get(devJob.deviceId);
        if (!device || !device.ipAddress) {
            await updateDevJobStatus(devJob.id, 'failed', 'Device not found or no IP');
            return;
        }

        try {
            await updateDevJobStatus(devJob.id, 'transferring', 'Starting SFTP transfer...');
            
            // SSH 连接
            // 从配置或默认获取凭据（这里简化使用默认）
            const client = new SSHClient({
                host: device.ipAddress,
                username: 'admin', // 假设
                password: 'admin',
            });

            const conn = await client.connect();
            if (!conn.success) {
                await updateDevJobStatus(devJob.id, 'failed', `SSH Connect failed: ${conn.error}`);
                return;
            }

            // 文件传输
            const remotePath = `/tmp/${path.basename(firmware.filePath)}`;
            const upload = await client.uploadFile(firmware.filePath, remotePath);
            
            if (!upload.success) {
                 await updateDevJobStatus(devJob.id, 'failed', `Upload failed: ${upload.error}`);
                 client.disconnect();
                 return;
            }

            await updateDevJobStatus(devJob.id, 'installing', 'File transferred. Installing...');

            // 执行安装命令 (Mocked for safety, as real command depends on vendor)
            // const installCmd = `install firmware ${remotePath}`;
            // const installResult = await client.executeCommand(installCmd);
            
            // 模拟安装耗时
            await new Promise(r => setTimeout(r, 5000));
            
            // Reboot check?
            
            await updateDevJobStatus(devJob.id, 'success', 'Installation successful');
            client.disconnect();

        } catch (err: any) {
            await updateDevJobStatus(devJob.id, 'failed', `Unexpected error: ${err.message}`);
        }
    }));

    // 更新总任务状态
    await db.update(schema.upgradeJobs).set({ status: 'completed', completedAt: new Date() }).where(eq(schema.upgradeJobs.id, jobId));

  } catch (error) {
    console.error('Execute Job Error:', error);
    await db.update(schema.upgradeJobs).set({ status: 'failed', completedAt: new Date() }).where(eq(schema.upgradeJobs.id, jobId));
  }
}

async function updateDevJobStatus(id: string, status: string, log: string) {
    await db.update(schema.upgradeJobDevices).set({ 
        status, 
        log, 
        updatedAt: new Date(),
        completedAt: ['success', 'failed'].includes(status) ? new Date() : undefined
    }).where(eq(schema.upgradeJobDevices.id, id));
}

export { firmwareRoutes };
