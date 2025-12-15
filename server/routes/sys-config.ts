import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const sysConfigRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 系统配置存储
const systemConfigs = new Map<string, string>([
  ['site_name', 'NetVis Pro'],
  ['site_logo', '/logo.png'],
  ['company_name', '网络运维管理平台'],
  ['login_background', '/login-bg.jpg'],
  ['primary_color', '#1677ff'],
  ['session_timeout', '24'],
  ['password_policy', 'medium'],
  ['max_login_attempts', '5'],
  ['two_factor_auth', 'false'],
  ['auto_logout_minutes', '30'],
  ['email_smtp_host', ''],
  ['email_smtp_port', '587'],
  ['email_smtp_user', ''],
  ['email_from', ''],
  ['syslog_enabled', 'false'],
  ['syslog_server', ''],
  ['backup_enabled', 'true'],
  ['backup_retention_days', '30'],
  ['data_retention_days', '365'],
]);

// 获取所有配置
sysConfigRoutes.get('/', authMiddleware, async (c) => {
  const configs = Object.fromEntries(systemConfigs);
  return c.json({ code: 0, data: configs });
});

// 获取配置分组
sysConfigRoutes.get('/groups', authMiddleware, async (c) => {
  const groups = [
    {
      key: 'general',
      name: '基本设置',
      configs: [
        { key: 'site_name', label: '系统名称', type: 'input' },
        { key: 'company_name', label: '公司名称', type: 'input' },
        { key: 'primary_color', label: '主题色', type: 'color' },
      ],
    },
    {
      key: 'security',
      name: '安全设置',
      configs: [
        { key: 'session_timeout', label: '会话超时(小时)', type: 'number' },
        { key: 'password_policy', label: '密码策略', type: 'select', options: ['low', 'medium', 'high'] },
        { key: 'max_login_attempts', label: '最大登录尝试', type: 'number' },
        { key: 'two_factor_auth', label: '双因素认证', type: 'switch' },
        { key: 'auto_logout_minutes', label: '自动登出(分钟)', type: 'number' },
      ],
    },
    {
      key: 'email',
      name: '邮件设置',
      configs: [
        { key: 'email_smtp_host', label: 'SMTP服务器', type: 'input' },
        { key: 'email_smtp_port', label: 'SMTP端口', type: 'number' },
        { key: 'email_smtp_user', label: 'SMTP用户名', type: 'input' },
        { key: 'email_from', label: '发件人地址', type: 'input' },
      ],
    },
    {
      key: 'data',
      name: '数据管理',
      configs: [
        { key: 'backup_enabled', label: '自动备份', type: 'switch' },
        { key: 'backup_retention_days', label: '备份保留天数', type: 'number' },
        { key: 'data_retention_days', label: '数据保留天数', type: 'number' },
      ],
    },
  ];

  return c.json({ code: 0, data: groups });
});

// 更新配置
sysConfigRoutes.put('/', authMiddleware, requireRole('admin'), zValidator('json', z.record(z.string(), z.string())), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    for (const [key, value] of Object.entries(data)) {
      systemConfigs.set(key, String(value));
    }

    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'update_system_config',
      resource: 'system',
      details: JSON.stringify({ keys: Object.keys(data) }),
    });

    return c.json({ code: 0, message: '配置更新成功' });
  } catch (error) {
    return c.json({ code: 500, message: '更新失败' }, 500);
  }
});

// 获取单个配置
sysConfigRoutes.get('/:key', authMiddleware, async (c) => {
  const key = c.req.param('key');
  const value = systemConfigs.get(key);

  if (value === undefined) {
    return c.json({ code: 404, message: '配置不存在' }, 404);
  }

  return c.json({ code: 0, data: { key, value } });
});

// 测试邮件配置
sysConfigRoutes.post('/test-email', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  to: z.string().email(),
})), async (c) => {
  const { to } = c.req.valid('json');

  // 模拟发送测试邮件
  return c.json({ 
    code: 0, 
    message: `测试邮件已发送到 ${to} (模拟)`,
    data: { success: true }
  });
});

// 重置配置为默认值
sysConfigRoutes.post('/reset', authMiddleware, requireRole('admin'), async (c) => {
  const currentUser = c.get('user');

  try {
    // 重置为默认值
    systemConfigs.set('site_name', 'NetVis Pro');
    systemConfigs.set('primary_color', '#1677ff');
    systemConfigs.set('session_timeout', '24');
    systemConfigs.set('password_policy', 'medium');
    systemConfigs.set('max_login_attempts', '5');
    systemConfigs.set('two_factor_auth', 'false');

    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'reset_system_config',
      resource: 'system',
      details: JSON.stringify({ type: 'reset_to_default' }),
    });

    return c.json({ code: 0, message: '配置已重置为默认值' });
  } catch (error) {
    return c.json({ code: 500, message: '重置失败' }, 500);
  }
});

export { sysConfigRoutes };
