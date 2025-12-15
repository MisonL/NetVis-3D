import { describe, it, expect, mock, beforeAll } from 'bun:test';

// Mock Mock DB for devices
const mockQuery = {
  from: () => mockQuery,
  where: () => mockQuery,
  orderBy: () => mockQuery,
  limit: () => mockQuery,
  offset: () => mockQuery,
  leftJoin: () => mockQuery,
  groupBy: () => mockQuery,
  // Promise interface for await
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
  checkDbConnection: () => Promise.resolve(true),
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

  it('GET /health should return healthy', async () => {
    const res = await healthRoutes.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('healthy');
  });

  it('GET /api/devices should return mocked list', async () => {
    const res = await deviceRoutes.request('/', {
      method: 'GET',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toBe(0);
    expect(body.data.list).toHaveLength(2);
    expect(body.data.list[0].name).toBe('Device A');
  });
});
