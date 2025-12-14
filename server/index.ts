import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { deviceRoutes } from './routes/devices';
import { alertRoutes } from './routes/alerts';
import { analyticsRoutes } from './routes/analytics';
import { licenseRoutes } from './routes/license';
import { auditRoutes } from './routes/audit';
import { openApiRoutes } from './routes/openapi';
import { configRoutes } from './routes/config';
import { reportRoutes } from './routes/report';
import { notificationRoutes } from './routes/notification';
import { systemRoutes } from './routes/system';
import { healthRoutes } from './routes/health';
import { docsRoutes } from './routes/docs';
import { discoveryRoutes } from './routes/discovery';

const app = new Hono();

// 中间件
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080'],
  credentials: true,
}));

// 路由
app.route('/api/auth', authRoutes);
app.route('/api/users', userRoutes);
app.route('/api/devices', deviceRoutes);
app.route('/api/alerts', alertRoutes);
app.route('/api/analytics', analyticsRoutes);
app.route('/api/license', licenseRoutes);
app.route('/api/audit', auditRoutes);
app.route('/api/openapi', openApiRoutes);
app.route('/api/config', configRoutes);
app.route('/api/report', reportRoutes);
app.route('/api/notifications', notificationRoutes);
app.route('/api/system', systemRoutes);
app.route('/api/docs', docsRoutes);
app.route('/api/discovery', discoveryRoutes);
app.route('/api', healthRoutes);

// 根路径
app.get('/', (c) => {
  return c.json({
    name: 'NetVis Pro API',
    version: '1.0.0',
    status: 'running',
  });
});

// 错误处理
app.onError((err, c) => {
  console.error('Server Error:', err);
  return c.json({
    code: 500,
    message: err.message || 'Internal Server Error',
  }, 500);
});

// 404处理
app.notFound((c) => {
  return c.json({
    code: 404,
    message: 'Not Found',
  }, 404);
});

export default {
  port: process.env.PORT || 3001,
  fetch: app.fetch,
};

console.log('🚀 NetVis Pro API Server running on http://localhost:3001');