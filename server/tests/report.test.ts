import { describe, it, expect, mock, beforeAll } from 'bun:test';

// Mock DB for Report
const mockReportData = [{
    id: '1',
    type: 'device-inventory',
    name: 'Report 1',
    status: 'completed'
}];

const mockQuery = {
  from: () => mockQuery,
  where: () => mockQuery,
  orderBy: () => mockQuery,
  limit: () => mockQuery,
  offset: () => mockQuery,
  groupBy: () => mockQuery,
  then: (resolve: any) => resolve(mockReportData),
};

mock.module('../db', () => ({
  db: {
    select: () => mockQuery,
    execute: () => Promise.resolve({ rows: [] }),
  },
  schema: {
    reports: { id: 'id', createdAt: 'createdAt' },
    reportSchedules: { id: 'id', createdAt: 'createdAt' },
    devices: { id: 'id' },
    alerts: { id: 'id', createdAt: 'createdAt' },
    syslogMessages: { id: 'id', timestamp: 'timestamp' },
    auditLogs: { id: 'id', createdAt: 'createdAt' },
  }
}));

mock.module('../middleware/auth', () => ({
  authMiddleware: async (c: any, next: any) => {
    c.set('user', { userId: 'admin', role: 'admin' });
    await next();
  },
  requireRole: () => async (c: any, next: any) => await next(),
}));

describe('Report API', async () => {
    const { reportRoutes } = await import('../routes/report');

    it('GET /types should return report types', async () => {
        const res = await reportRoutes.request('/types');
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.data).toBeDefined();
        expect(Array.isArray(body.data)).toBe(true);
    });

    it('GET /history should return history', async () => {
        const res = await reportRoutes.request('/history?page=1');
        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.data.list).toBeDefined();
    });

    it('POST /generate/device-inventory should generate report', async () => {
        const res = await reportRoutes.request('/generate/device-inventory', {
            method: 'POST',
            body: JSON.stringify({ format: 'json' }),
            headers: {'Content-Type': 'application/json'}
        });
        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.data).toBeDefined();
    });
});
