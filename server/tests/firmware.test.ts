import { describe, it, expect, mock, beforeAll } from 'bun:test';

// Mock DB
const mockQuery = {
  from: () => mockQuery,
  where: () => mockQuery,
  orderBy: () => mockQuery,
  limit: () => mockQuery,
  then: (resolve: any) => resolve([
    { id: '1', name: 'fw-1.0.bin', version: '1.0' }
  ]),
};

mock.module('../db', () => ({
  db: {
    select: () => mockQuery,
    insert: () => ({ values: () => ({ returning: () => Promise.resolve([{ id: 'mock-id', name: 'fw.bin' }]) }) }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
  },
  schema: {
    firmwares: { id: 'id' },
    upgradeJobs: { id: 'id' },
    upgradeJobDevices: { id: 'id' },
    devices: { id: 'id' },
  }
}));

// Mock Auth
mock.module('../middleware/auth', () => ({
  authMiddleware: async (c: any, next: any) => {
    c.set('user', { userId: 'admin', role: 'admin' });
    await next();
  },
  requireRole: () => async (c: any, next: any) => await next(),
}));

// Mock SSHClient
mock.module('../utils/ssh-client', () => ({
    SSHClient: class {
        connect() { return Promise.resolve({ success: true }); }
        uploadFile() { return Promise.resolve({ success: true }); }
        executeCommand() { return Promise.resolve({ success: true }); }
        disconnect() {}
    }
}));

// Mock Bun.write?
// Bun.write is global. Hard to mock directly in module mock?
// But we can just let it run (it writes to uploads dir). Or we can spy it?
// For now, assume it works or just checks logic flow.
// Actually uploading real file in test is noisy.
// We can skip 'POST /upload' test or use a temp dir.
// Let's test Job creation which triggers DB logic.

describe('Firmware Routes', async () => {
    // Dynamic import to apply mocks
    const { firmwareRoutes } = await import('../routes/firmware');

    it('GET / should return firmware list', async () => {
        const res = await firmwareRoutes.request('/');
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.code).toBe(0);
        expect(body.data).toHaveLength(1);
    });

    it('POST /jobs should create job', async () => {
        const res = await firmwareRoutes.request('/jobs', {
            method: 'POST',
            body: JSON.stringify({
                name: 'Upgrade Job',
                firmwareId: '1',
                deviceIds: ['d1', 'd2']
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.code).toBe(0);
        expect(body.message).toBe('任务创建成功');
    });
});
