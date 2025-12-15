import { describe, it, expect, mock } from 'bun:test';

// Mock DB
const mockQuery = {
  from: () => mockQuery,
  where: () => mockQuery,
  orderBy: () => mockQuery,
  limit: () => mockQuery,
  offset: () => mockQuery,
  leftJoin: () => mockQuery,
  groupBy: () => mockQuery,
  then: (resolve: any) => resolve([]),
};

mock.module('../db', () => ({
  db: {
    select: () => mockQuery,
    execute: () => Promise.resolve({ rows: [{ avg_latency: 25.5, avg_cpu: 45.2, avg_memory: 60.1 }] }),
  },
  checkDbConnection: () => Promise.resolve(true),
  schema: {
    devices: { id: 'id', name: 'name', status: 'status' },
    deviceMetrics: { deviceId: 'deviceId', timestamp: 'timestamp' },
  }
}));

mock.module('../middleware/auth', () => ({
  authMiddleware: async (c: any, next: any) => {
    c.set('user', { userId: '00000000-0000-0000-0000-000000000003', role: 'admin' });
    await next();
  },
  requireRole: () => async (c: any, next: any) => await next(),
}));

import { metricsRoutes } from '../routes/metrics';

describe('Metrics API', () => {
  it('GET /dashboard - should return dashboard stats', async () => {
    const res = await metricsRoutes.request('/dashboard');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.code).toBe(0);
  });

  it('GET /top - should return top devices', async () => {
    const res = await metricsRoutes.request('/top?metric=latency&limit=5');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.code).toBe(0);
  });
});
