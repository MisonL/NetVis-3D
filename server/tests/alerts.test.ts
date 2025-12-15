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
    execute: () => Promise.resolve({ rows: [{ total: 10, critical: 2, warning: 3 }] }),
  },
  checkDbConnection: () => Promise.resolve(true),
  schema: {
    alerts: { id: 'id', severity: 'severity', status: 'status', createdAt: 'createdAt' },
    alertRules: { id: 'id', isEnabled: 'isEnabled' },
    devices: { id: 'id', name: 'name' },
  }
}));

mock.module('../middleware/auth', () => ({
  authMiddleware: async (c: any, next: any) => {
    c.set('user', { userId: '00000000-0000-0000-0000-000000000002', role: 'admin' });
    await next();
  },
  requireRole: () => async (c: any, next: any) => await next(),
}));

import { alertRoutes } from '../routes/alerts';

describe('Alerts API', () => {
  it('GET / - should return alert list', async () => {
    const res = await alertRoutes.request('/');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.code).toBe(0);
  });

  it('GET /stats - should return alert statistics', async () => {
    const res = await alertRoutes.request('/stats');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.code).toBe(0);
  });
});
