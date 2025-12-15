import { describe, it, expect, mock, beforeAll } from 'bun:test';

// Mock Mock DB for devices (Full Export Match)
const mockQuery = {
  from: () => mockQuery,
  where: () => mockQuery,
  orderBy: () => mockQuery,
  limit: () => mockQuery,
  offset: () => mockQuery,
  leftJoin: () => mockQuery,
  groupBy: () => mockQuery,
  then: (resolve: any) => resolve([
    { id: '1', name: 'Device A', ipAddress: '192.168.1.1', status: 'online' },
    { id: '2', name: 'Device B', ipAddress: '192.168.1.2', status: 'offline' }
  ]),
};

mock.module('../db', () => ({
  db: {
    select: () => mockQuery,
    execute: () => Promise.resolve({ rows: [] }),
  },
  checkDbConnection: () => Promise.resolve(true), // Explicitly exported
  schema: {
    devices: { createdAt: 'createdAt' },
  }
}));

// Mock Auth to allow access
mock.module('../middleware/auth', () => ({
  authMiddleware: async (c: any, next: any) => {
    c.set('user', { userId: 'admin', role: 'admin' });
    await next();
  },
  requireRole: () => async (c: any, next: any) => await next(),
  verifyToken: () => ({ userId: 'admin', role: 'admin' }),
  generateToken: () => 'mock_token',
}));

describe('Basic API Routes', async () => {
  const { healthRoutes } = await import('../routes/health');
  const { deviceRoutes } = await import('../routes/devices');

  it('GET /health should return health status', async () => {
    const res = await healthRoutes.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('healthy');
  });

  it('GET / on devices should return devices', async () => {
    const res = await deviceRoutes.request('/');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.code).toBe(0);
  });
});
