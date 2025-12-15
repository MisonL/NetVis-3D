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

// In-memory cache for configs
const systemConfigs = new Map<string, string>();

// 默认配置定义
const DEFAULT_CONFIGS = [
  { key: 'site_name', value: 'NetVis Pro', category: 'general', description: '系统名称' },
  { key: 'site_logo', value: '/logo.png', category: 'general', description: '系统Logo' },
  { key: 'company_name', value: '网络运维管理平台', category: 'general', description: '公司名称' },
  { key: 'primary_color', value: '#1677ff', category: 'general', description: '主题色' },
  { key: 'session_timeout', value: '24', category: 'security', description: '会话超时(小时)' },
  { key: 'password_policy', value: 'medium', category: 'security', description: '密码策略' },
  { key: 'max_login_attempts', value: '5', category: 'security', description: '最大登录尝试' },
  { key: 'two_factor_auth', value: 'false', category: 'security', description: '双因素认证' },
  { key: 'auto_logout_minutes', value: '30', category: 'security', description: '自动登出(分钟)' },
  { key: 'email_smtp_host', value: '', category: 'email', description: 'SMTP服务器' },
  { key: 'email_smtp_port', value: '587', category: 'email', description: 'SMTP端口' },
  { key: 'email_smtp_user', value: '', category: 'email', description: 'SMTP用户名' },
  { key: 'email_from', value: '', category: 'email', description: '发件人地址' },
  { key: 'email_smtp_pass', value: '', category: 'email', description: 'SMTP密码' }, // encrypted?
  { key: 'backup_enabled', value: 'true', category: 'data', description: '自动备份' },
  { key: 'backup_retention_days', value: '30', category: 'data', description: '备份保留天数' },
  { key: 'data_retention_days', value: '365', category: 'data', description: '数据保留天数' },
  // WeChat Configs
  { key: 'wechat_corp_id', value: '', category: 'wechat', description: '企业ID' },
  { key: 'wechat_agent_id', value: '', category: 'wechat', description: '应用ID' },
  { key: 'wechat_secret', value: '', category: 'wechat', description: '应用Secret' },
  { key: 'wechat_enabled', value: 'false', category: 'wechat', description: '启用企业微信通知' },
];

// 初始化默认配置
export async function initSystemSettings() {
    for (const conf of DEFAULT_CONFIGS) {
        await db.insert(schema.systemSettings)
            .values(conf)
            .onConflictDoNothing()
            .execute();
        // Load into memory
        systemConfigs.set(conf.key, conf.value);
    }
    // Reload all from DB to ensure latest
    const all = await db.select().from(schema.systemSettings);
    all.forEach(s => systemConfigs.set(s.key, s.value || ''));
}

// 获取所有配置
sysConfigRoutes.get('/', authMiddleware, async (c) => {
  const settings = await db.select().from(schema.systemSettings);
  const configMap: Record<string, string> = {};
  settings.forEach(s => {
      configMap[s.key] = s.value || '';
      systemConfigs.set(s.key, s.value || ''); // Sync cache
  });
  return c.json({ code: 0, data: configMap });
});

// 获取配置分组
sysConfigRoutes.get('/groups', authMiddleware, async (c) => {
  // 定义Schema结构 for Frontend
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
        { key: 'email_smtp_pass', label: 'SMTP密码', type: 'password' },
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
    {
      key: 'wechat',
      name: '企业微信通知',
      configs: [
        { key: 'wechat_enabled', label: '启用企业微信通知', type: 'switch' },
        { key: 'wechat_corp_id', label: '企业ID (CorpID)', type: 'input' },
        { key: 'wechat_agent_id', label: '应用ID (AgentID)', type: 'number' },
        { key: 'wechat_secret', label: '应用Secret', type: 'password' },
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
        await db.insert(schema.systemSettings)
            .values({ 
                key, 
                value: String(value),
                updatedBy: currentUser.userId,
                updatedAt: new Date()
            })
            .onConflictDoUpdate({
                target: schema.systemSettings.key,
                set: { 
                    value: String(value),
                    updatedBy: currentUser.userId,
                    updatedAt: new Date()
                }
            });
    }

    // 审计日志
    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'update_sys_config',
      resource: 'system_settings',
      details: JSON.stringify(Object.keys(data)),
    });

    return c.json({ code: 0, message: '配置更新成功' });
  } catch (error) {
    console.error('Update config error:', error);
    return c.json({ code: 500, message: '配置更新失败' }, 500);
  }
});

// 获取单个配置
sysConfigRoutes.get('/:key', authMiddleware, async (c) => {
  const key = c.req.param('key');
  const setting = await db.select().from(schema.systemSettings).where(eq(schema.systemSettings.key, key)).limit(1);

  if (setting.length === 0) {
    return c.json({ code: 404, message: '配置不存在' }, 404);
  }

  return c.json({ code: 0, data: { key, value: setting[0]?.value } });
});

// 测试邮件配置
sysConfigRoutes.post('/test-email', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  to: z.string().email(),
})), async (c) => {
  const { to } = c.req.valid('json');

  try {
    // 获取邮件配置
    const smtpHost = systemConfigs.get('email_smtp_host');
    const smtpPort = parseInt(systemConfigs.get('email_smtp_port') || '587');
    const smtpUser = systemConfigs.get('email_smtp_user');
    const smtpPass = systemConfigs.get('email_smtp_pass') || '';
    const emailFrom = systemConfigs.get('email_from');

    if (!smtpHost || !smtpUser) {
      return c.json({ 
        code: 400, 
        message: '请先配置SMTP服务器和用户名',
        data: { success: false }
      }, 400);
    }

    // 使用nodemailer发送真实邮件
    const nodemailer = await import('nodemailer');
    
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: emailFrom || smtpUser,
      to: to,
      subject: 'NetVis Pro 测试邮件',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #1677ff;">NetVis Pro 邮件配置测试</h2>
          <p>恭喜！您的邮件服务器配置正确。</p>
          <p>此邮件由 NetVis Pro 网络管理平台自动发送。</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">发送时间: ${new Date().toLocaleString('zh-CN')}</p>
        </div>
      `,
    });

    return c.json({ 
      code: 0, 
      message: `测试邮件已成功发送到 ${to}`,
      data: { success: true }
    });
  } catch (error) {
    console.error('Send test email error:', error);
    return c.json({ 
      code: 500, 
      message: `邮件发送失败: ${error instanceof Error ? error.message : '未知错误'}`,
      data: { success: false }
    }, 500);
  }
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
