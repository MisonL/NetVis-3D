import { describe, it, expect, mock, beforeAll } from 'bun:test';

// Mock Drizzle ORM to allow inspecting conditions
mock.module('drizzle-orm', () => ({
  eq: (col: any, val: any) => ({ type: 'eq', col, val }),
  desc: (col: any) => ({ type: 'desc', col }),
  count: () => ({ type: 'count' }),
  and: (...args: any[]) => ({ type: 'and', args }),
  gte: () => ({}),
  lte: () => ({}),
  sql: () => ({}),
}));

const mockUser = {
  id: 'test-user',
  username: 'test',
  role: 'admin',
  password: 'hashed-password',
  email: 'test@example.com',
  createdAt: new Date(),
  updatedAt: new Date()
};

// Stateless mock that reacts to query conditions
const mockSelect = () => {
    let result = [mockUser];
    return {
        from: () => ({
            where: (cond: any) => {
                // If checking by ID, find user
                if (cond && cond.col === 'id' && cond.val === 'test-user') {
                    return createQueryChain([mockUser]);
                }
                // If checking by username (create check), return empty
                if (cond && cond.col === 'username') {
                    return createQueryChain([]);
                }
                // If checking by email (create check), return empty
                if (cond && cond.col === 'email') {
                    return createQueryChain([]);
                }
                // Default: return valid user (for list lists etc, filter might be complex)
                return createQueryChain([mockUser]);
            },
            orderBy: () => createQueryChain([mockUser]),
            limit: () => createQueryChain([mockUser]),
            offset: () => createQueryChain([mockUser]),
            then: (r:any) => r([mockUser])
        }),
        orderBy: () => createQueryChain([mockUser]),
        limit: () => createQueryChain([mockUser]),
        offset: () => createQueryChain([mockUser]),
        then: (r:any) => r([mockUser])
    }
};

const createQueryChain = (data: any[]) => ({
    limit: () => createQueryChain(data),
    offset: () => createQueryChain(data),
    orderBy: () => createQueryChain(data),
    where: () => createQueryChain(data), // Chainable
    then: (resolve: any) => resolve(data)
});

mock.module('../db', () => ({
  db: {
    select: mockSelect,
    insert: () => ({ values: () => ({ returning: () => Promise.resolve([mockUser]) }) }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    delete: () => ({ where: () => Promise.resolve() }),
  },
  schema: {
    users: { id: 'id', username: 'username', isActive: 'isActive', email: 'email', createdAt: 'createdAt' },
    auditLogs: { createdAt: 'createdAt' },
    licenses: { isActive: 'isActive' }
  }
}));

mock.module('../middleware/auth', () => ({
  authMiddleware: async (c: any, next: any) => {
    c.set('user', { userId: 'admin', role: 'admin' });
    await next();
  },
  requireRole: () => async (c: any, next: any) => await next(),
}));

mock.module('../middleware/license', () => ({
  beforeAddUser: () => Promise.resolve({ allowed: true }),
}));

describe('Users API', async () => {
  const { userRoutes: usersRoutes } = await import('../routes/users');

  it('GET / should return user list', async () => {
    const res = await usersRoutes.request('/?page=1&pageSize=10');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.list).toBeDefined();
    expect(body.data.list.length).toBeGreaterThan(0);
  });

  it('POST / should create user', async () => {
    const res = await usersRoutes.request('/', {
      method: 'POST',
      body: JSON.stringify({ username: 'newuser', password: 'password123', role: 'user', email: 'new@example.com' }),
      headers: { 'Content-Type': 'application/json' }
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.code).toBe(0);
  });

  it('PUT /:id should update user', async () => {
    const res = await usersRoutes.request('/test-user', { // Matches ID check
        method: 'PUT',
        body: JSON.stringify({ role: 'admin' }),
        headers: { 'Content-Type': 'application/json' }
    });
    expect(res.status).toBe(200);
  });

  it('DELETE /:id should delete user', async () => {
      const res = await usersRoutes.request('/test-user', { method: 'DELETE' });
      expect(res.status).toBe(200);
  });
});
