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
    execute: () => Promise.resolve({ rows: [{ total: 5 }] }),
  },
  checkDbConnection: () => Promise.resolve(true),
  schema: {
    topologyLinks: { id: 'id', sourceId: 'sourceId', targetId: 'targetId' },
    devices: { id: 'id', name: 'name', status: 'status' },
  }
}));

mock.module('../middleware/auth', () => ({
  authMiddleware: async (c: any, next: any) => {
    c.set('user', { userId: '00000000-0000-0000-0000-000000000006', role: 'admin' });
    await next();
  },
  requireRole: () => async (c: any, next: any) => await next(),
}));

import { topologyRoutes } from '../routes/topology-manage';

describe('Topology Manage API', () => {
  it('GET /connections - should return topology connections', async () => {
    const res = await topologyRoutes.request('/connections');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.code).toBe(0);
  });

  it('GET /graph - should return topology graph data', async () => {
    const res = await topologyRoutes.request('/graph');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.code).toBe(0);
  });

  it('GET /stats - should return topology statistics', async () => {
    const res = await topologyRoutes.request('/stats');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.code).toBe(0);
  });
});
