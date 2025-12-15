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
    insert: () => ({ values: () => ({ returning: () => Promise.resolve([{ id: 'task-id' }]) }) }),
    execute: () => Promise.resolve({ rows: [] }),
  },
  checkDbConnection: () => Promise.resolve(true),
  schema: {
    discoveryTasks: { id: 'id', status: 'status' },
    devices: { id: 'id' },
  }
}));

mock.module('../middleware/auth', () => ({
  authMiddleware: async (c: any, next: any) => {
    c.set('user', { userId: '00000000-0000-0000-0000-000000000005', role: 'admin' });
    await next();
  },
  requireRole: () => async (c: any, next: any) => await next(),
}));

import { discoveryRoutes } from '../routes/discovery';

describe('Discovery API', () => {
  it('GET /tasks - should return discovery task list', async () => {
    const res = await discoveryRoutes.request('/tasks');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.code).toBe(0);
  });
});
