import { describe, it, expect, mock } from 'bun:test';

// Mock DB (保持不变)
const mockDb = {
  select: () => mockDb,
  from: () => mockDb,
  where: () => mockDb,
  limit: () => Promise.resolve([]),
  update: () => mockDb,
  set: () => mockDb,
  insert: () => mockDb,
  values: () => mockDb,
  returning: () => Promise.resolve([{ id: 'mock-id' }]),
};

mock.module('../db', () => ({
  db: mockDb,
  schema: {
    licenses: { isActive: 'isActive' },
    auditLogs: {},
  }
}));

// Mock Auth
mock.module('../middleware/auth', () => ({
  authMiddleware: async (c: any, next: any) => {
    c.set('user', { userId: 'admin-id', role: 'admin' });
    await next();
  },
  requireRole: () => async (c: any, next: any) => await next(),
}));

describe('License Routes', async () => {
  // 动态导入确保mock生效
  const { licenseRoutes } = await import('../routes/license');

  it('should generate a trial license and import it successfully', async () => {
    // 1. Generate
    const resGen = await licenseRoutes.request('/generate-trial', { method: 'POST' });
    expect(resGen.status).toBe(200);
    const bodyGen = await resGen.json();
    expect(bodyGen.code).toBe(0);
    const { licenseKey } = bodyGen.data;
    expect(licenseKey).toBeTruthy();
    expect(licenseKey).toContain('.');

    // 2. Import
    const resImp = await licenseRoutes.request('/import', {
      method: 'POST',
      body: JSON.stringify({ licenseKey }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(resImp.status).toBe(200);
    const bodyImp = await resImp.json();
    expect(bodyImp.code).toBe(0);
    expect(bodyImp.message).toBe('License激活成功');
  });

  it('should reject invalid license format', async () => {
    const res = await licenseRoutes.request('/import', {
      method: 'POST',
      body: JSON.stringify({ licenseKey: 'invalid-key' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(400);
  });
});
