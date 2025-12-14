import { Context, Next } from 'hono';
import { db, schema } from '../db';
import { eq, count } from 'drizzle-orm';

// License状态缓存（避免每次请求都查数据库）
let licenseCache: {
  data: LicenseInfo | null;
  timestamp: number;
} = { data: null, timestamp: 0 };

const CACHE_TTL = 60 * 1000; // 1分钟缓存

export interface LicenseInfo {
  edition: string;
  modules: string[];
  maxDevices: number;
  maxUsers: number;
  expiresAt: Date | null;
  isActive: boolean;
  isExpired: boolean;
}

// 获取当前License信息（带缓存）
export async function getLicenseInfo(): Promise<LicenseInfo> {
  const now = Date.now();
  
  // 检查缓存
  if (licenseCache.data && now - licenseCache.timestamp < CACHE_TTL) {
    return licenseCache.data;
  }

  // 查询数据库
  const [license] = await db
    .select()
    .from(schema.licenses)
    .where(eq(schema.licenses.isActive, true))
    .limit(1);

  if (!license) {
    // 无License，使用社区版限制
    const info: LicenseInfo = {
      edition: 'community',
      modules: ['CORE'],
      maxDevices: 10,
      maxUsers: 3,
      expiresAt: null,
      isActive: false,
      isExpired: false,
    };
    licenseCache = { data: info, timestamp: now };
    return info;
  }

  const isExpired = license.expiresAt ? new Date(license.expiresAt) < new Date() : false;
  
  const info: LicenseInfo = {
    edition: license.edition,
    modules: license.modules || ['CORE'],
    maxDevices: license.maxDevices,
    maxUsers: license.maxUsers,
    expiresAt: license.expiresAt,
    isActive: license.isActive,
    isExpired,
  };
  
  licenseCache = { data: info, timestamp: now };
  return info;
}

// 清除License缓存（导入新License后调用）
export function clearLicenseCache() {
  licenseCache = { data: null, timestamp: 0 };
}

// 检查模块是否授权
export async function isModuleEnabled(moduleCode: string): Promise<boolean> {
  const license = await getLicenseInfo();
  return license.modules.includes(moduleCode);
}

// 检查设备点数是否超限
export async function checkDeviceLimit(): Promise<{ allowed: boolean; current: number; max: number }> {
  const license = await getLicenseInfo();
  const [result] = await db.select({ total: count() }).from(schema.devices);
  const current = result?.total || 0;
  
  return {
    allowed: current < license.maxDevices,
    current,
    max: license.maxDevices,
  };
}

// 检查用户数是否超限
export async function checkUserLimit(): Promise<{ allowed: boolean; current: number; max: number }> {
  const license = await getLicenseInfo();
  const [result] = await db.select({ total: count() }).from(schema.users);
  const current = result?.total || 0;
  
  return {
    allowed: current < license.maxUsers,
    current,
    max: license.maxUsers,
  };
}

// 创建模块授权检查中间件
export function requireModule(moduleCode: string) {
  return async (c: Context, next: Next) => {
    const enabled = await isModuleEnabled(moduleCode);
    
    if (!enabled) {
      return c.json({
        code: 403,
        message: `模块 [${moduleCode}] 未授权，请升级License`,
        data: {
          requiredModule: moduleCode,
          upgradeUrl: '/settings/license',
        },
      }, 403);
    }
    
    await next();
  };
}

// 检查License是否有效
export function requireValidLicense() {
  return async (c: Context, next: Next) => {
    const license = await getLicenseInfo();
    
    if (license.isExpired) {
      return c.json({
        code: 403,
        message: 'License已过期，系统处于只读模式',
        data: {
          expiredAt: license.expiresAt,
          readOnly: true,
        },
      }, 403);
    }
    
    await next();
  };
}

// 设备新增前检查
export async function beforeAddDevice(): Promise<{ allowed: boolean; message?: string }> {
  const check = await checkDeviceLimit();
  
  if (!check.allowed) {
    return {
      allowed: false,
      message: `设备数量已达上限 (${check.current}/${check.max})，请升级License`,
    };
  }
  
  return { allowed: true };
}

// 用户新增前检查
export async function beforeAddUser(): Promise<{ allowed: boolean; message?: string }> {
  const check = await checkUserLimit();
  
  if (!check.allowed) {
    return {
      allowed: false,
      message: `用户数量已达上限 (${check.current}/${check.max})，请升级License`,
    };
  }
  
  return { allowed: true };
}
