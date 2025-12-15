import { describe, it, expect, mock, beforeAll } from 'bun:test';
import { Hono } from 'hono';

// Generic Mock DB to prevent crashes on load
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
    insert: () => ({ values: () => ({ returning: () => Promise.resolve([{ id: 'mock', count: 0 }]), onConflictDoNothing: () => ({ execute: () => Promise.resolve() }), onConflictDoUpdate: () => Promise.resolve() }) }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    delete: () => ({ where: () => Promise.resolve() }),
    execute: () => Promise.resolve({ rows: [] }),
  },
  checkDbConnection: () => Promise.resolve(true),
  schema: new Proxy({}, { get: () => ({}) }), // Catch-all schema
}));

mock.module('../middleware/auth', () => ({
  authMiddleware: async (c: any, next: any) => {
    c.set('user', { userId: 'admin', role: 'admin' });
    await next();
  },
  requireRole: () => async (c: any, next: any) => await next(),
}));

// List of all route files to smoke test
const routesToTest = [
  'users',
  'analytics',
  'audit',
  'openapi',
  'report',
  'notification',
  'system',
  'docs',
  'schedule',
  'collector',
  'backup',
  'groups',
  'templates',
  'device-health',
  'api-stats',
  'maintenance',
  'ssh',
  'baseline',
  'wxwork',
  'workflow',
  'export',
  'bigscreen',
  'knowledge',
  'inventory',
  'oncall',
  'dashboard-config',
  'topology-layout',
  'security',
  'performance',
  'network-quality',
  'tags',
  'batch-task',
  'change-management',
  'capacity',
  'cmdb',
  'incident',
  'sla',
  'ipam',
  'port-mapping',
  'link-monitor',
  'device-template',
  'log-analysis',
  'network-tools',
  'event-bus',
  'datacenter',
  'alert-channel',
  'topology-export',
  'tenant',
  'cache',
  'network-diagnostics',
  'access-control',
  'rate-limit'
];

describe('Smoke Tests for All Routes', () => {
  routesToTest.forEach(routeName => {
    it(`should load and respond on ${routeName} route`, async () => {
      try {
        const module = await import(`../routes/${routeName}`);
        // Find the exported Hono instance
        const route = Object.values(module).find((exp: any) => exp && typeof exp.request === 'function') as Hono;
        
        if (route) {
            // Just check if it responds to a basic GET / or similar
            // We expect 200, 401, 403, 404, but NOT 500 (crash)
            // Since we mocked auth to pass, it should likely return 200 or 404
            const res = await route.request('/');
            expect([200, 404, 400, 401, 403]).toContain(res.status);
        } else {
            console.warn(`No Hono app found in ${routeName}`);
        }
      } catch (e) {
        console.error(`Failed to load or test ${routeName}:`, e);
        // Fail the test if it crashes
        expect(e).toBeUndefined();
      }
    });
  });
});
