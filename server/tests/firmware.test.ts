import { describe, it, expect, mock } from 'bun:test';

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
    insert: () => ({ values: () => ({ returning: () => Promise.resolve([{ id: 'mock-job-id', name: 'test-job' }]) }) }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
  },
  checkDbConnection: () => Promise.resolve(true),
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

describe('Firmware Routes', async () => {
    const { firmwareRoutes } = await import('../routes/firmware');

    it('GET / should return list', async () => {
        const res = await firmwareRoutes.request('/');
        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.code).toBe(0);
    });

    it('POST /jobs should create upgrade job', async () => {
        const res = await firmwareRoutes.request('/jobs', {
            method: 'POST',
            body: JSON.stringify({
                name: 'Test Upgrade',
                deviceIds: ['dev1'],
                firmwareId: 'fw1',
            }),
            headers: { 'Content-Type': 'application/json' }
        });
        
        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.code).toBe(0);
    });
});
