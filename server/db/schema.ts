import { pgTable, text, timestamp, boolean, uuid, integer } from 'drizzle-orm/pg-core';

// 用户表
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  displayName: text('display_name'),
  avatar: text('avatar'),
  role: text('role').notNull().default('user'), // admin, user, viewer
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 角色表
export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  permissions: text('permissions').array(), // 权限列表
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 审计日志表
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  action: text('action').notNull(), // login, logout, create, update, delete
  resource: text('resource').notNull(), // users, devices, alerts
  resourceId: text('resource_id'),
  details: text('details'), // JSON string
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// 设备表
export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  label: text('label'),
  type: text('type').notNull(), // router, switch, firewall, server
  vendor: text('vendor'), // cisco, huawei, h3c, ruijie
  model: text('model'),
  ipAddress: text('ip_address'),
  macAddress: text('mac_address'),
  location: text('location'),
  groupId: uuid('group_id'),
  status: text('status').notNull().default('unknown'), // online, offline, warning, error
  lastSeen: timestamp('last_seen'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 设备分组表
export const deviceGroups = pgTable('device_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  parentId: uuid('parent_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 告警规则表
export const alertRules = pgTable('alert_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(), // threshold, status, composite
  conditions: text('conditions').notNull(), // JSON string
  severity: text('severity').notNull().default('warning'), // info, warning, critical
  isEnabled: boolean('is_enabled').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 告警表
export const alerts = pgTable('alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  ruleId: uuid('rule_id').references(() => alertRules.id),
  deviceId: uuid('device_id').references(() => devices.id),
  severity: text('severity').notNull(), // info, warning, critical
  status: text('status').notNull().default('pending'), // pending, acknowledged, resolved
  message: text('message').notNull(),
  details: text('details'), // JSON string
  acknowledgedBy: uuid('acknowledged_by').references(() => users.id),
  acknowledgedAt: timestamp('acknowledged_at'),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// License表
export const licenses = pgTable('licenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  licenseKey: text('license_key').notNull().unique(),
  edition: text('edition').notNull(), // basic, professional, enterprise
  modules: text('modules').array(), // 激活的模块列表
  maxDevices: integer('max_devices').notNull().default(100),
  maxUsers: integer('max_users').notNull().default(5),
  customerId: text('customer_id'),
  customerName: text('customer_name'),
  issuedAt: timestamp('issued_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// 配置备份表
export const configBackups = pgTable('config_backups', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').references(() => devices.id).notNull(),
  type: text('type').notNull().default('running'), // running, startup, full
  version: text('version').notNull(),
  content: text('content').notNull(),
  size: integer('size').notNull(),
  hash: text('hash').notNull(), // MD5 hash
  description: text('description'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// 配置模板表
export const configTemplates = pgTable('config_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  vendor: text('vendor').notNull(), // cisco, huawei, h3c
  deviceType: text('device_type').notNull(), // router, switch, firewall
  content: text('content').notNull(),
  variables: text('variables').array(), // 变量列表
  description: text('description'),
  isSystem: boolean('is_system').notNull().default(false),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 配置下发历史表
export const configDeployments = pgTable('config_deployments', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').references(() => devices.id).notNull(),
  content: text('content').notNull(),
  status: text('status').notNull().default('pending'), // pending, running, success, failed
  linesApplied: integer('lines_applied').default(0),
  duration: integer('duration'), // ms
  error: text('error'),
  description: text('description'),
  deployedBy: uuid('deployed_by').references(() => users.id),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// 报表记录表
export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: text('type').notNull(), // device_health, alert_stats, traffic_trend, capacity
  params: text('params'), // JSON string 报表参数
  status: text('status').notNull().default('pending'), // pending, generating, completed, failed
  filePath: text('file_path'),
  fileSize: integer('file_size'),
  format: text('format').notNull().default('pdf'), // pdf, excel, csv
  error: text('error'),
  generatedBy: uuid('generated_by').references(() => users.id),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// 报表定时任务表
export const reportSchedules = pgTable('report_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  reportType: text('report_type').notNull(),
  params: text('params'), // JSON string
  cron: text('cron').notNull(), // cron表达式
  recipients: text('recipients').array(), // 接收人邮箱
  isEnabled: boolean('is_enabled').notNull().default(true),
  lastRunAt: timestamp('last_run_at'),
  nextRunAt: timestamp('next_run_at'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 通知渠道表
export const notificationChannels = pgTable('notification_channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: text('type').notNull(), // email, webhook, dingtalk, wechat, slack
  config: text('config').notNull(), // JSON string 渠道配置
  isEnabled: boolean('is_enabled').notNull().default(true),
  isDefault: boolean('is_default').notNull().default(false),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// API Keys表
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  key: text('key').notNull().unique(),
  secret: text('secret').notNull(),
  permissions: text('permissions').array(), // read, write, admin
  rateLimit: integer('rate_limit').notNull().default(1000),
  isActive: boolean('is_active').notNull().default(true),
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Webhooks表
export const webhooks = pgTable('webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  secret: text('secret').notNull(),
  events: text('events').array(), // device.online, device.offline, alert.created
  isActive: boolean('is_active').notNull().default(true),
  lastTriggeredAt: timestamp('last_triggered_at'),
  failCount: integer('fail_count').notNull().default(0),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// 采集器表
export const collectors = pgTable('collectors', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  version: text('version'),
  status: text('status').notNull().default('offline'), // online, offline
  lastHeartbeat: timestamp('last_heartbeat'),
  startedAt: timestamp('started_at'),
  config: text('config'), // JSON
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// 设备指标时序表 (TimescaleDB hypertable)
export const deviceMetrics = pgTable('device_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').references(() => devices.id),
  collectorId: text('collector_id').references(() => collectors.id),
  status: text('status').notNull(), // online, offline
  latency: integer('latency'), // ms
  packetLoss: integer('packet_loss'), // %
  cpuUsage: integer('cpu_usage'), // %
  memoryUsage: integer('memory_usage'), // %
  uptime: integer('uptime'), // seconds
  timestamp: timestamp('timestamp').notNull().defaultNow(),
});

// 接口流量时序表
export const interfaceMetrics = pgTable('interface_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').references(() => devices.id),
  interfaceName: text('interface_name').notNull(),
  inBytes: integer('in_bytes'),
  outBytes: integer('out_bytes'),
  inErrors: integer('in_errors'),
  outErrors: integer('out_errors'),
  status: text('status'),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
});

// 类型导出
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
export type Alert = typeof alerts.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type License = typeof licenses.$inferSelect;
export type ConfigBackup = typeof configBackups.$inferSelect;
export type ConfigTemplate = typeof configTemplates.$inferSelect;
export type ConfigDeployment = typeof configDeployments.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type ReportSchedule = typeof reportSchedules.$inferSelect;
export type NotificationChannel = typeof notificationChannels.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Webhook = typeof webhooks.$inferSelect;
export type Collector = typeof collectors.$inferSelect;
export type DeviceMetric = typeof deviceMetrics.$inferSelect;
export type InterfaceMetric = typeof interfaceMetrics.$inferSelect;
