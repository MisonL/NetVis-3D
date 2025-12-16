/**
 * 测试预加载文件
 * 用于在所有测试运行前设置全局mocks
 */
import { mock } from 'bun:test';

// 全局Mock DB模块
const mockQuery = {
  from: () => mockQuery,
  where: () => mockQuery,
  orderBy: () => mockQuery,
  limit: () => mockQuery,
  offset: () => mockQuery,
  leftJoin: () => mockQuery,
  groupBy: () => mockQuery,
  then: (resolve: Function) => resolve([]),
};

mock.module('../db', () => ({
  db: {
    select: () => mockQuery,
    insert: () => ({ 
      values: () => ({ 
        returning: () => Promise.resolve([{ id: 'mock', count: 0 }]), 
        onConflictDoNothing: () => ({ execute: () => Promise.resolve() }), 
        onConflictDoUpdate: () => Promise.resolve() 
      }) 
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    delete: () => ({ where: () => Promise.resolve() }),
    execute: () => Promise.resolve({ rows: [] }),
  },
  checkDbConnection: () => Promise.resolve(true),
  schema: new Proxy({}, { get: () => ({}) }),
}));

// 全局Mock License模块
mock.module('../middleware/license', () => ({
  beforeAddDevice: () => Promise.resolve({ allowed: true }),
  beforeAddUser: () => Promise.resolve({ allowed: true }),
  getLicenseInfo: () => Promise.resolve({ 
    edition: 'enterprise', 
    modules: ['CORE', 'ASSET', 'ALERT', 'SSH', 'CONFIG', 'REPORT', 'AUDIT', 'HA', 'MOBILE', 'API'], 
    maxDevices: 10000, 
    maxUsers: 1000, 
    isActive: true, 
    isExpired: false 
  }),
  isModuleEnabled: () => Promise.resolve(true),
  checkDeviceLimit: () => Promise.resolve({ allowed: true, current: 5, max: 10000 }),
  checkUserLimit: () => Promise.resolve({ allowed: true, current: 3, max: 1000 }),
  requireModule: () => async (c: unknown, next: Function) => await next(),
  requireValidLicense: () => async (c: unknown, next: Function) => await next(),
  clearLicenseCache: () => {},
}));

// 全局Mock Auth模块
mock.module('../middleware/auth', () => ({
  authMiddleware: async (c: unknown, next: Function) => {
    (c as { set: (key: string, value: unknown) => void }).set('user', { userId: 'admin', role: 'admin' });
    await next();
  },
  requireRole: () => async (c: unknown, next: Function) => await next(),
  verifyToken: () => ({ userId: 'admin', role: 'admin' }),
  generateToken: () => 'mock_token',
  JwtPayload: {},
}));

// 全局Mock prom-client
mock.module('prom-client', () => ({
  Registry: class { 
    metrics() { return '# HELP test_metric Test\ntest_metric 1'; } 
    contentType = 'text/plain; version=0.0.4; charset=utf-8';
  },
  collectDefaultMetrics: () => {},
  Gauge: class { 
    constructor() {} 
    set() {} 
    labels() { return { set: () => {} }; }
  },
  Counter: class { constructor() {} inc() {} },
  Histogram: class { constructor() {} observe() {} },
  register: { metrics: () => '', contentType: 'text/plain' }
}));

console.log('✓ Test setup loaded: Global mocks applied');
