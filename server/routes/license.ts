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
          edition: 'community',
          modules: ['CORE'],
          limits: {
            maxDevices: 10,
            maxUsers: 3,
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

// 导入/激活License
licenseRoutes.post('/import', authMiddleware, requireRole('admin'), zValidator('json', licenseImportSchema), async (c) => {
  const { licenseKey } = c.req.valid('json');

  try {
    // 解析License Key (简化版本 - 实际应使用RSA验签)
    // 格式: NV-{edition}-{modules}-{devices}-{users}-{expiry}-{checksum}
    const parts = licenseKey.split('-');
    if (parts.length < 7 || parts[0] !== 'NV') {
      return c.json({ code: 400, message: 'License Key格式无效' }, 400);
    }

    const edition = parts[1]?.toLowerCase() || 'basic';
    const modulesStr = parts[2] || 'B';
    const maxDevices = parseInt(parts[3] || '100') || 100;
    const maxUsers = parseInt(parts[4] || '10') || 10;
    const expiryDays = parseInt(parts[5] || '365') || 365;
    const checksum = parts[6] || '';

    // 简单校验 (实际应使用RSA)
    const expectedChecksum = crypto
      .createHash('md5')
      .update(`${edition}${modulesStr}${maxDevices}${maxUsers}${expiryDays}NETVIS_SECRET`)
      .digest('hex')
      .substring(0, 8);

    if (checksum !== expectedChecksum) {
      return c.json({ code: 400, message: 'License Key校验失败' }, 400);
    }

    // 解析模块
    const moduleMap: Record<string, string[]> = {
      'B': ['CORE', 'ASSET'],
      'P': ['CORE', 'ASSET', 'ALERT', 'SSH', 'CONFIG', 'REPORT'],
      'E': ['CORE', 'ASSET', 'ALERT', 'SSH', 'CONFIG', 'REPORT', 'AUDIT', 'HA', 'MOBILE', 'API'],
    };
    const modules = moduleMap[modulesStr] || ['CORE'];

    // 计算过期时间
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

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
        customerName: 'Enterprise Customer',
        edition,
        modules,
        maxDevices,
        maxUsers,
        expiresAt,
        isActive: true,
      })
      .returning();

    // 记录审计日志
    await db.insert(schema.auditLogs).values({
      action: 'import',
      resource: 'license',
      resourceId: result[0]?.id,
      details: JSON.stringify({ edition, modules, maxDevices }),
    });

    return c.json({
      code: 0,
      message: 'License激活成功',
      data: {
        edition,
        modules,
        maxDevices,
        maxUsers,
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

    const modules = license?.modules || ['CORE'];

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
  try {
    const edition = 'professional';
    const modulesStr = 'P';
    const maxDevices = 100;
    const maxUsers = 10;
    const expiryDays = 30;

    const checksum = crypto
      .createHash('md5')
      .update(`${edition}${modulesStr}${maxDevices}${maxUsers}${expiryDays}NETVIS_SECRET`)
      .digest('hex')
      .substring(0, 8);

    const licenseKey = `NV-${edition}-${modulesStr}-${maxDevices}-${maxUsers}-${expiryDays}-${checksum}`;

    return c.json({
      code: 0,
      data: {
        licenseKey,
        edition,
        validDays: expiryDays,
      },
    });
  } catch (error) {
    console.error('Generate trial license error:', error);
    return c.json({ code: 500, message: '生成试用License失败' }, 500);
  }
});

export { licenseRoutes };
