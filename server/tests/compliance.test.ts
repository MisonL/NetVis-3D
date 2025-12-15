import { describe, it, expect, mock } from 'bun:test';

// Mock DB
const mockQuery = {
  from: () => mockQuery,
  where: () => mockQuery,
  leftJoin: () => mockQuery,
  orderBy: () => mockQuery,
  limit: () => mockQuery,
  then: (resolve: any) => resolve([{ count: 0 }]),
};

mock.module('../db', () => ({
  db: {
    select: () => ({ ...mockQuery, then: (resolve: any) => resolve([{ count: 0 }]) }), // for count
    insert: () => ({ values: () => ({ returning: () => Promise.resolve([{ id: 'mock-id' }]) }) }),
  },
  schema: {
    complianceRules: { category: 'category' },
    complianceResults: { status: 'status' },
    devices: { id: 'id' },
    configBackups: { id: 'id' }, 
    auditLogs: {},
  }
}));

mock.module('../middleware/auth', () => ({
  authMiddleware: async (c: any, next: any) => {
    c.set('user', { userId: 'admin', role: 'admin' });
    await next();
  },
  requireRole: () => async (c: any, next: any) => await next(),
}));

mock.module('../utils/ssh-client', () => ({
    SSHClient: class {
        connect() { return Promise.resolve({ success: true }); }
        getRunningConfig() { return Promise.resolve({ success: true, output: 'hostname router-1\nservice password-encryption\n' }); }
        disconnect() {}
    }
}));

describe('Compliance Routes', async () => {
    const { complianceRoutes } = await import('../routes/compliance');

    it('GET /rules should return rules', async () => {
        const res = await complianceRoutes.request('/rules');
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.code).toBe(0);
        // Expect defaults to be initialized if count was 0
        // But mock returns count 0, then select returns [].
        // The code awaits initialisation (which inserts defaults), then selects.
        // It should call db.insert.
    });

    it('POST /scan should start scan', async () => {
        const res = await complianceRoutes.request('/scan', {
            method: 'POST',
            body: JSON.stringify({}),
            headers: { 'Content-Type': 'application/json' }
        });
        expect(res.status).toBe(200);
        // It triggers async logic. We can't easily wait for async scan here unless we sleep or mock execution.
        // The endpoint returns immediately.
    });
});
