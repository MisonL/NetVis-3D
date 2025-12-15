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
    execute: () => Promise.resolve({ rows: [] }),
  },
  checkDbConnection: () => Promise.resolve(true),
  schema: {
    configBackups: { id: 'id', deviceId: 'deviceId', createdAt: 'createdAt' },
    configTemplates: { id: 'id', name: 'name' },
    devices: { id: 'id', name: 'name' },
  }
}));

mock.module('../middleware/auth', () => ({
  authMiddleware: async (c: any, next: any) => {
    c.set('user', { userId: '00000000-0000-0000-0000-000000000004', role: 'admin' });
    await next();
  },
  requireRole: () => async (c: any, next: any) => await next(),
}));

import { configRoutes } from '../routes/config';

describe('Config API', () => {
  it('GET /backups - should return backup list', async () => {
    const res = await configRoutes.request('/backups');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.code).toBe(0);
  });

  it('GET /templates - should return template list', async () => {
    const res = await configRoutes.request('/templates');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.code).toBe(0);
  });
});
