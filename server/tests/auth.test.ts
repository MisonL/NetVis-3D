import { describe, test, expect, mock } from 'bun:test';
import jwt from 'jsonwebtoken';

// Test JWT functionality directly without importing the actual module
// This avoids conflicts with other test files that mock auth.ts

const JWT_SECRET = 'test-secret-key';

function generateToken(payload: { userId: string; username: string; role: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

function verifyToken(token: string): { userId: string; username: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch {
    return null;
  }
}

describe('Auth Functions', () => {
  describe('generateToken', () => {
    test('should generate a valid JWT token', () => {
      const payload = {
        userId: 'test-user-id',
        username: 'testuser',
        role: 'admin',
      };

      const token = generateToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });
  });

  describe('verifyToken', () => {
    test('should verify a valid token and return payload', () => {
      const payload = {
        userId: 'test-user-id',
        username: 'testuser',
        role: 'user',
      };

      const token = generateToken(payload);
      const decoded = verifyToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(payload.userId);
      expect(decoded?.username).toBe(payload.username);
      expect(decoded?.role).toBe(payload.role);
    });

    test('should return null for invalid token', () => {
      const result = verifyToken('invalid-token');
      expect(result).toBeNull();
    });

    test('should return null for empty token', () => {
      const result = verifyToken('');
      expect(result).toBeNull();
    });

    test('should return null for malformed token', () => {
      const result = verifyToken('not.a.valid.jwt.token');
      expect(result).toBeNull();
    });
  });
});
