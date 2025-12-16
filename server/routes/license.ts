import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';
import crypto from 'crypto';

const licenseRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// License文件Schema
const licenseImportSchema = z.object({
  licenseKey: z.string().min(10, 'License Key无效'),
});

// 获取当前License信息
licenseRoutes.get('/info', authMiddleware, async (c) => {
  try {
    const [license] = await db
      .select()
      .from(schema.licenses)
      .where(eq(schema.licenses.isActive, true))
      .limit(1);

    if (!license) {
      return c.json({
        code: 0,
        data: {
          status: 'unlicensed',
          edition: 'development',
          modules: ['CORE', 'ASSET', 'ALERT', 'SSH', 'CONFIG', 'REPORT', 'AUDIT', 'HA', 'MOBILE', 'API', 'SYSTEM', 'TOOLS', 'ADVANCED', 'BIGSCREEN'],
          limits: {
            maxDevices: 1000,
            maxUsers: 100,
          },
          expiresAt: null,
        },
      });
    }

    // 检查是否过期
    const isExpired = license.expiresAt && new Date(license.expiresAt) < new Date();

    return c.json({
      code: 0,
      data: {
        status: isExpired ? 'expired' : 'active',
        licenseId: license.licenseKey,
        edition: license.edition,
        customer: license.customerName,
        modules: license.modules || ['CORE'],
        limits: {
          maxDevices: license.maxDevices,
          maxUsers: license.maxUsers,
        },
        expiresAt: license.expiresAt,
        issuedAt: license.issuedAt,
      },
    });
  } catch (error) {
    console.error('Get license info error:', error);
    return c.json({ code: 500, message: '获取License信息失败' }, 500);
  }
});

// 读取密钥
import fs from 'fs';
import path from 'path';

let publicKey = '';
let privateKey = '';

try {
  publicKey = fs.readFileSync(path.join(process.cwd(), 'public_key.pem'), 'utf8');
} catch (e) {
  console.warn('Public key not found, license verification will verify against empty key (likely fail) or disabled');
}

try {
  privateKey = fs.readFileSync(path.join(process.cwd(), 'private_key.pem'), 'utf8');
} catch (e) {
  console.warn('Private key not found, trial license generation disabled');
}

// 导入/激活License
licenseRoutes.post('/import', authMiddleware, requireRole('admin'), zValidator('json', licenseImportSchema), async (c) => {
  const { licenseKey } = c.req.valid('json');

  try {
    // 格式: PayloadBase64.SignatureBase64
    const [payloadB64, signatureB64] = licenseKey.split('.');
    if (!payloadB64 || !signatureB64) {
      return c.json({ code: 400, message: 'License格式无效' }, 400);
    }

    // 1. RSA验签
    const verify = crypto.createVerify('SHA256');
    verify.update(payloadB64);
    verify.end();
    
    const isValid = verify.verify(publicKey, signatureB64, 'base64');
    if (!isValid) {
      return c.json({ code: 400, message: 'License签名验证失败' }, 400);
    }

    // 2. 解析Payload
    const payloadStr = Buffer.from(payloadB64, 'base64').toString('utf8');
    const licenseData = JSON.parse(payloadStr);

    // {
    //   customer: string,
    //   edition: string,
    //   modules: string[],
    //   limits: { maxDevices: number, maxUsers: number },
    //   expiresAt: string,
    //   nonce: string
    // }

    // 检查是否过期
    const expiresAt = new Date(licenseData.expiresAt);
    if (expiresAt < new Date()) {
      return c.json({ code: 400, message: 'License已过期' }, 400);
    }

    // 禁用旧License
    await db
      .update(schema.licenses)
      .set({ isActive: false })
      .where(eq(schema.licenses.isActive, true));

    // 插入新License
    const result = await db
      .insert(schema.licenses)
      .values({
        licenseKey,
        customerName: licenseData.customer || 'Unknown Customer',
        edition: licenseData.edition || 'standard',
        modules: licenseData.modules || ['CORE'],
        maxDevices: licenseData.limits?.maxDevices || 10,
        maxUsers: licenseData.limits?.maxUsers || 3,
        expiresAt,
        isActive: true,
      })
      .returning();

    // 记录审计日志
    await db.insert(schema.auditLogs).values({
      userId: c.get('user').userId,
      action: 'import',
      resource: 'license',
      resourceId: result[0]?.id,
      details: JSON.stringify({ customer: licenseData.customer, expiresAt }),
    });

    return c.json({
      code: 0,
      message: 'License激活成功',
      data: {
        customer: licenseData.customer,
        expiresAt,
      },
    });
  } catch (error) {
    console.error('Import license error:', error);
    return c.json({ code: 500, message: 'License导入失败' }, 500);
  }
});

// 获取使用量统计
licenseRoutes.get('/usage', authMiddleware, async (c) => {
  try {
    const [license] = await db
      .select()
      .from(schema.licenses)
      .where(eq(schema.licenses.isActive, true))
      .limit(1);

    // 统计当前使用量
    const deviceCount = await db.select().from(schema.devices);
    const userCount = await db.select().from(schema.users);

    const maxDevices = license?.maxDevices || 10;
    const maxUsers = license?.maxUsers || 3;

    return c.json({
      code: 0,
      data: {
        devices: {
          used: deviceCount.length,
          max: maxDevices,
          percentage: Math.round((deviceCount.length / maxDevices) * 100),
        },
        users: {
          used: userCount.length,
          max: maxUsers,
          percentage: Math.round((userCount.length / maxUsers) * 100),
        },
      },
    });
  } catch (error) {
    console.error('Get license usage error:', error);
    return c.json({ code: 500, message: '获取使用量失败' }, 500);
  }
});

// 获取已激活模块
licenseRoutes.get('/modules', authMiddleware, async (c) => {
  try {
    const [license] = await db
      .select()
      .from(schema.licenses)
      .where(eq(schema.licenses.isActive, true))
      .limit(1);

    const modules = license?.modules || ['CORE', 'ASSET', 'ALERT', 'SSH', 'CONFIG', 'REPORT', 'AUDIT', 'HA', 'MOBILE', 'API', 'SYSTEM', 'TOOLS', 'ADVANCED', 'BIGSCREEN'];

    const allModules = [
      { code: 'CORE', name: '核心功能', description: '仪表盘+拓扑可视化' },
      { code: 'ASSET', name: '资产管理', description: '设备生命周期管理' },
      { code: 'ALERT', name: '告警管理', description: '告警规则与通知' },
      { code: 'SSH', name: 'SSH管理', description: '设备远程管理' },
      { code: 'CONFIG', name: '配置管理', description: '配置备份与下发' },
      { code: 'REPORT', name: '报表中心', description: '数据分析报表' },
      { code: 'AUDIT', name: '审计日志', description: '操作审计追踪' },
      { code: 'HA', name: '高可用', description: '多活灾备' },
      { code: 'MOBILE', name: '移动端', description: '企微/APP' },
      { code: 'API', name: '开放API', description: '第三方集成' },
    ];

    return c.json({
      code: 0,
      data: allModules.map(m => ({
        ...m,
        enabled: modules.includes(m.code),
      })),
    });
  } catch (error) {
    console.error('Get license modules error:', error);
    return c.json({ code: 500, message: '获取模块列表失败' }, 500);
  }
});

// 生成试用License (仅开发用)
licenseRoutes.post('/generate-trial', authMiddleware, requireRole('admin'), async (c) => {
  if (!privateKey) {
    return c.json({ code: 500, message: '服务端未配置私钥，无法生成License' }, 500);
  }

  try {
    const payload = {
      customer: 'Trial User',
      edition: 'professional',
      modules: ['CORE', 'ASSET', 'ALERT', 'SSH', 'CONFIG', 'REPORT', 'HA'],
      limits: {
        maxDevices: 100,
        maxUsers: 10,
      },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      nonce: crypto.randomUUID(),
    };

    const payloadStr = JSON.stringify(payload);
    const payloadB64 = Buffer.from(payloadStr).toString('base64');

    const sign = crypto.createSign('SHA256');
    sign.update(payloadB64);
    sign.end();
    const signatureB64 = sign.sign(privateKey, 'base64');

    const licenseKey = `${payloadB64}.${signatureB64}`;

    return c.json({
      code: 0,
      data: {
        licenseKey,
        edition: payload.edition,
        validDays: 30,
      },
    });
  } catch (error) {
    console.error('Generate trial license error:', error);
    return c.json({ code: 500, message: '生成试用License失败' }, 500);
  }
});

export { licenseRoutes };
