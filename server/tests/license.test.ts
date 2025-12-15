import { describe, it, expect, mock } from 'bun:test';

// Mock DB
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
  checkDbConnection: () => Promise.resolve(true),
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

// Mock fs for public key reading
mock.module('fs', () => ({
  readFileSync: () => 'mock-key-content',
  existsSync: () => true,
  default: {
    readFileSync: () => 'mock-key-content',
    existsSync: () => true,
  }
}));

describe('License Routes', async () => {
  const { licenseRoutes } = await import('../routes/license');

  it('should return current license status', async () => {
    const res = await licenseRoutes.request('/current');
    // May return 200 or 404 depending on mock data
    expect([200, 404]).toContain(res.status);
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
