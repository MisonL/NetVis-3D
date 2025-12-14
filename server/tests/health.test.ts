import { describe, test, expect } from 'bun:test';
import app from '../index';

interface ApiResponse {
  name?: string;
  version?: string;
  status?: string;
  timestamp?: string;
  checks?: unknown;
  code?: number;
  message?: string;
}

describe('Health Routes', () => {
  describe('GET /', () => {
    test('should return API info', async () => {
      const res = await app.fetch(new Request('http://localhost:3001/'));
      const data = await res.json() as ApiResponse;

      expect(res.status).toBe(200);
      expect(data.name).toBe('NetVis Pro API');
      expect(data.version).toBe('1.0.0');
      expect(data.status).toBe('running');
    });
  });

  describe('GET /api/health', () => {
    test('should return health status', async () => {
      const res = await app.fetch(new Request('http://localhost:3001/api/health'));
      const data = await res.json() as ApiResponse;

      expect(res.status).toBeDefined();
      expect(data.version).toBe('1.0.0');
      expect(data.timestamp).toBeDefined();
      expect(data.checks).toBeDefined();
    });
  });

  describe('GET /api/metrics', () => {
    test('should return Prometheus metrics', async () => {
      const res = await app.fetch(new Request('http://localhost:3001/api/metrics'));
      const text = await res.text();

      expect(res.status).toBe(200);
      expect(text).toContain('netvis_uptime_seconds');
      expect(text).toContain('netvis_memory_usage_bytes');
    });
  });

  describe('404 Handler', () => {
    test('should return 404 for unknown routes', async () => {
      const res = await app.fetch(new Request('http://localhost:3001/unknown-route'));
      const data = await res.json() as ApiResponse;

      expect(res.status).toBe(404);
      expect(data.code).toBe(404);
      expect(data.message).toBe('Not Found');
    });
  });
});

