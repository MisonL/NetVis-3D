import { Hono } from 'hono';
import { swaggerUI } from '@hono/swagger-ui';

const docsRoutes = new Hono();

// OpenAPI 3.0 规范
const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'NetVis Pro API',
    description: '企业级网络设备拓扑可视化平台接口文档',
    version: '1.0.0',
    contact: {
      name: 'NetVis Pro Team',
      email: 'support@netvis.pro',
    },
    license: {
      name: 'Commercial',
    },
  },
  servers: [
    {
      url: 'http://localhost:3001',
      description: '开发环境',
    },
  ],
  tags: [
    { name: 'Auth', description: '认证授权' },
    { name: 'Users', description: '用户管理' },
    { name: 'Devices', description: '设备管理' },
    { name: 'Alerts', description: '告警管理' },
    { name: 'License', description: '授权管理' },
    { name: 'Audit', description: '审计日志' },
    { name: 'Config', description: '配置管理' },
    { name: 'Report', description: '报表中心' },
    { name: 'Notification', description: '通知中心' },
    { name: 'System', description: '系统监控' },
    { name: 'OpenAPI', description: '开放API' },
  ],
  paths: {
    // 认证接口
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: '用户登录',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: { type: 'string', example: 'admin' },
                  password: { type: 'string', example: 'admin123' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: '登录成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    code: { type: 'integer', example: 0 },
                    message: { type: 'string', example: '登录成功' },
                    data: {
                      type: 'object',
                      properties: {
                        token: { type: 'string' },
                        user: { $ref: '#/components/schemas/User' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: '获取当前用户信息',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    code: { type: 'integer', example: 0 },
                    data: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
        },
      },
    },
    // 设备接口
    '/api/devices': {
      get: {
        tags: ['Devices'],
        summary: '获取设备列表',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'keyword', in: 'query', schema: { type: 'string' } },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['router', 'switch', 'firewall', 'server', 'ap'] } },
        ],
        responses: {
          '200': {
            description: '成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    code: { type: 'integer', example: 0 },
                    data: {
                      type: 'object',
                      properties: {
                        list: { type: 'array', items: { $ref: '#/components/schemas/Device' } },
                        total: { type: 'integer' },
                        page: { type: 'integer' },
                        pageSize: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Devices'],
        summary: '创建设备',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DeviceInput' },
            },
          },
        },
        responses: {
          '200': { description: '创建成功' },
          '403': { description: '设备数量已达上限' },
        },
      },
    },
    // 告警接口
    '/api/alerts': {
      get: {
        tags: ['Alerts'],
        summary: '获取告警列表',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'severity', in: 'query', schema: { type: 'string', enum: ['critical', 'warning', 'info'] } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'acknowledged', 'resolved'] } },
        ],
        responses: {
          '200': { description: '成功' },
        },
      },
    },
    // License接口
    '/api/license/info': {
      get: {
        tags: ['License'],
        summary: '获取License信息',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: '成功',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LicenseInfo' },
              },
            },
          },
        },
      },
    },
    '/api/license/usage': {
      get: {
        tags: ['License'],
        summary: '获取使用量统计',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: '成功' } },
      },
    },
    // 系统接口
    '/api/system/health': {
      get: {
        tags: ['System'],
        summary: '系统健康检查',
        responses: {
          '200': {
            description: '成功',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthCheck' },
              },
            },
          },
        },
      },
    },
    '/api/system/metrics': {
      get: {
        tags: ['System'],
        summary: '系统资源监控',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: '成功' } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
          displayName: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'user', 'viewer'] },
          avatar: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Device: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          label: { type: 'string' },
          type: { type: 'string', enum: ['router', 'switch', 'firewall', 'server', 'ap', 'other'] },
          vendor: { type: 'string' },
          model: { type: 'string' },
          ipAddress: { type: 'string' },
          macAddress: { type: 'string' },
          status: { type: 'string', enum: ['online', 'offline', 'warning', 'error', 'unknown'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      DeviceInput: {
        type: 'object',
        required: ['name', 'type'],
        properties: {
          name: { type: 'string', example: 'Core Switch 01' },
          type: { type: 'string', enum: ['router', 'switch', 'firewall', 'server', 'ap', 'other'] },
          vendor: { type: 'string', example: 'Cisco' },
          model: { type: 'string', example: 'Catalyst 9500' },
          ipAddress: { type: 'string', example: '192.168.1.1' },
          macAddress: { type: 'string', example: '00:1A:2B:3C:4D:5E' },
          location: { type: 'string', example: 'DC-1 Rack-A1' },
        },
      },
      LicenseInfo: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['active', 'expired', 'unlicensed'] },
          edition: { type: 'string', enum: ['community', 'basic', 'professional', 'enterprise'] },
          modules: { type: 'array', items: { type: 'string' } },
          limits: {
            type: 'object',
            properties: {
              maxDevices: { type: 'integer' },
              maxUsers: { type: 'integer' },
            },
          },
          expiresAt: { type: 'string', format: 'date-time' },
        },
      },
      HealthCheck: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
          version: { type: 'string' },
          uptime: { type: 'integer' },
          uptimeFormatted: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
};

// Swagger UI 页面
docsRoutes.get(
  '/ui',
  swaggerUI({
    url: '/api/docs/openapi.json',
  })
);

// OpenAPI JSON
docsRoutes.get('/openapi.json', (c) => {
  return c.json(openApiSpec);
});

// API 文档首页
docsRoutes.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>NetVis Pro API 文档</title>
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
        }
        .card {
          background: rgba(255,255,255,0.95);
          border-radius: 16px;
          padding: 40px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 { 
          color: #1a1a2e; 
          margin-bottom: 8px;
        }
        .subtitle { 
          color: #666; 
          margin-bottom: 32px;
        }
        .links { 
          display: flex; 
          gap: 16px;
          flex-wrap: wrap;
        }
        a {
          display: inline-flex;
          align-items: center;
          padding: 12px 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 500;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        a:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(102,126,234,0.4);
        }
        .version { 
          margin-top: 32px;
          padding-top: 16px;
          border-top: 1px solid #eee;
          color: #888;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>🚀 NetVis Pro API</h1>
        <p class="subtitle">企业级网络设备拓扑可视化平台接口文档</p>
        <div class="links">
          <a href="/api/docs/ui">📖 Swagger UI</a>
          <a href="/api/docs/openapi.json">📄 OpenAPI JSON</a>
        </div>
        <div class="version">
          <strong>版本:</strong> 1.0.0 | 
          <strong>接口数:</strong> 13个模块 | 
          <strong>认证:</strong> JWT Bearer Token
        </div>
      </div>
    </body>
    </html>
  `);
});

export { docsRoutes };
