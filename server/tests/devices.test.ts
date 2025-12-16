import { describe, it, expect, mock, beforeAll } from 'bun:test';

// Mock DB
const mockQuery = {
  from: () => mockQuery,
  where: () => mockQuery,
  orderBy: () => mockQuery,
  limit: () => mockQuery,
  offset: () => mockQuery,
  leftJoin: () => mockQuery,
  groupBy: () => mockQuery,
  then: (resolve: any) => resolve([
    { id: '1', name: 'Device A', ipAddress: '192.168.1.1', status: 'online', type: 'router' },
    { id: '2', name: 'Device B', ipAddress: '192.168.1.2', status: 'offline', type: 'switch' }
  ]),
};

mock.module('../db', () => ({
  db: {
    select: () => mockQuery,
    insert: () => ({ values: () => ({ returning: () => Promise.resolve([{ id: 'new-device-id' }]) }) }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    delete: () => ({ where: () => Promise.resolve() }),
    execute: () => Promise.resolve({ rows: [] }),
  },
  checkDbConnection: () => Promise.resolve(true),
  schema: {
    devices: { id: 'id', name: 'name', createdAt: 'createdAt', status: 'status' },
    auditLogs: {},
  }
}));

mock.module('../middleware/auth', () => ({
  authMiddleware: async (c: any, next: any) => {
    c.set('user', { userId: '00000000-0000-0000-0000-000000000001', role: 'admin' });
    await next();
  },
  requireRole: () => async (c: any, next: any) => await next(),
}));

mock.module('../middleware/license', () => ({
  beforeAddDevice: () => Promise.resolve({ allowed: true }),
  beforeAddUser: () => Promise.resolve({ allowed: true }),
  getLicenseInfo: () => Promise.resolve({ edition: 'enterprise', modules: ['CORE'], maxDevices: 1000, maxUsers: 100, isActive: true, isExpired: false }),
  isModuleEnabled: () => Promise.resolve(true),
  checkDeviceLimit: () => Promise.resolve({ allowed: true, current: 5, max: 1000 }),
  checkUserLimit: () => Promise.resolve({ allowed: true, current: 3, max: 100 }),
  requireModule: () => async (c: any, next: any) => await next(),
  requireValidLicense: () => async (c: any, next: any) => await next(),
  clearLicenseCache: () => {},
}));

// Import routes AFTER mocking (dynamic import inside describe)

describe('Devices API', async () => {
  const { deviceRoutes } = await import('../routes/devices');
  
  it('GET / - should return paginated device list', async () => {
    const res = await deviceRoutes.request('/');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.code).toBe(0);
    expect(body.data).toBeDefined();
  });

  it('GET /stats - should return device statistics', async () => {
    const res = await deviceRoutes.request('/stats');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.code).toBe(0);
  });
});
