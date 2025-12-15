import { Hono } from 'hono';
import { checkDbConnection } from '../db';

const healthRoutes = new Hono();

// 基础健康检查
healthRoutes.get('/health', async (c) => {
  const dbOk = await checkDbConnection();
  
  const status = dbOk ? 'healthy' : 'degraded';
  const statusCode = dbOk ? 200 : 503;

  return c.json({
    status,
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks: {
      database: dbOk ? 'ok' : 'error',
      redis: 'disabled', // 当前运行在无Redis模式
    },
  }, statusCode);
});

// 数据库健康检查
healthRoutes.get('/health/db', async (c) => {
  const ok = await checkDbConnection();
  
  return c.json({
    status: ok ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
  }, ok ? 200 : 503);
});

// Prometheus指标（简化版）
healthRoutes.get('/metrics', async (c) => {
  const metrics = `
# HELP netvis_uptime_seconds Server uptime in seconds
# TYPE netvis_uptime_seconds gauge
netvis_uptime_seconds ${process.uptime()}

# HELP netvis_requests_total Total number of requests
# TYPE netvis_requests_total counter
netvis_requests_total 0

# HELP netvis_memory_usage_bytes Memory usage in bytes
# TYPE netvis_memory_usage_bytes gauge
netvis_memory_usage_bytes ${process.memoryUsage().heapUsed}
`.trim();

  return c.text(metrics, 200, {
    'Content-Type': 'text/plain; version=0.0.4',
  });
});

export { healthRoutes };
