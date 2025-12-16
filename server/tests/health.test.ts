import { describe, test, expect, mock } from 'bun:test';

// Mock DB to prevent license.ts from loading public_key.pem
mock.module('../db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          then: (resolve: any) => resolve([])
        })
      })
    }),
    execute: () => Promise.resolve({ rows: [] }),
  },
  checkDbConnection: () => Promise.resolve(true),
  schema: { devices: {}, deviceMetrics: {} }
}));

mock.module('../middleware/auth', () => ({
  authMiddleware: async (c: any, next: any) => {
    c.set('user', { userId: 'admin', role: 'admin' });
    await next();
  },
  requireRole: () => async (c: any, next: any) => await next(),
  verifyToken: () => ({ userId: 'admin', role: 'admin' }),
  generateToken: () => 'mock_token',
  JwtPayload: {}
}));

// Mock prom-client to avoid metric conflicts
mock.module('prom-client', () => ({
  Registry: class { 
    metrics() { return '# HELP test_metric Test\ntest_metric 1'; } 
    contentType = 'text/plain; version=0.0.4; charset=utf-8';
  },
  collectDefaultMetrics: () => {},
  Gauge: class { 
    constructor() {} 
    set() {} 
    labels() { return { set: () => {} }; }
  },
  Counter: class { constructor() {} inc() {} },
  Histogram: class { constructor() {} observe() {} },
  register: { metrics: () => '', contentType: 'text/plain' }
}));

// Mock fs to prevent license key loading
mock.module('fs', () => ({
  readFileSync: () => 'mock-key-content',
  existsSync: () => true,
  writeFileSync: () => {},
  mkdirSync: () => {},
  statSync: () => ({ size: 100 }),
  default: {
    readFileSync: () => 'mock-key-content',
    existsSync: () => true,
    writeFileSync: () => {},
    mkdirSync: () => {},
    statSync: () => ({ size: 100 }),
  }
}));

describe('Health Routes', async () => {
  const { healthRoutes } = await import('../routes/health');

  test('should return health status', async () => {
    const res = await healthRoutes.request('/health');
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.status).toBe('healthy');
  });

  test('should return Prometheus metrics', async () => {
    const res = await healthRoutes.request('/metrics');
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(typeof text).toBe('string');
  });
});
