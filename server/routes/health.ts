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

// Prometheus指标集成
import * as client from 'prom-client';

// 创建Register
const register = new client.Registry();

// 添加默认指标 (CPU, Memory, Event Loop等)
client.collectDefaultMetrics({ register, prefix: 'netvis_' });

// 自定义指标
const dbStatus = new client.Gauge({
  name: 'netvis_db_up',
  help: 'Database connection status (1 = up, 0 = down)',
  registers: [register],
});

const activeRequests = new client.Gauge({
  name: 'netvis_active_requests',
  help: 'Number of active HTTP requests',
  registers: [register],
});

healthRoutes.get('/metrics', async (c) => {
  try {
    // 更新DB状态
    const ok = await checkDbConnection();
    dbStatus.set(ok ? 1 : 0);

    // 获取指标数据
    const metrics = await register.metrics();
    
    return c.text(metrics, 200, {
      'Content-Type': register.contentType,
    });
  } catch (error) {
    console.error('Metrics generation error:', error);
    return c.json({ code: 500, message: '指标生成失败' }, 500);
  }
});

export { healthRoutes };
