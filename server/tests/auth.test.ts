import { describe, test, expect } from 'bun:test';
import { generateToken, verifyToken } from '../middleware/auth';

describe('Auth Middleware', () => {
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
