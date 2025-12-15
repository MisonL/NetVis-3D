import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc, and, gte, count } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const complianceRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 合规规则存储
const complianceRules = new Map<string, {
  id: string;
  name: string;
  category: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  checkType: 'config' | 'security' | 'performance' | 'inventory';
  enabled: boolean;
  expression: string;
  createdAt: Date;
}>();

// 初始化默认规则
const defaultRules = [
  { id: '1', name: 'SSH弱密码检测', category: '安全合规', checkType: 'security', severity: 'critical', description: '检测设备是否使用弱密码或默认密码' },
  { id: '2', name: 'SNMP社区名检查', category: '安全合规', checkType: 'security', severity: 'high', description: '检测是否使用public/private默认社区名' },
  { id: '3', name: 'Telnet服务检测', category: '安全合规', checkType: 'security', severity: 'high', description: '检测设备是否开启不安全的Telnet服务' },
  { id: '4', name: '配置备份检查', category: '配置合规', checkType: 'config', severity: 'medium', description: '检测设备配置是否定期备份' },
  { id: '5', name: 'NTP服务配置', category: '配置合规', checkType: 'config', severity: 'low', description: '检测设备是否配置NTP时间同步' },
  { id: '6', name: 'Syslog配置', category: '配置合规', checkType: 'config', severity: 'medium', description: '检测设备是否配置日志服务器' },
  { id: '7', name: 'AAA认证配置', category: '安全合规', checkType: 'security', severity: 'high', description: '检测设备是否启用AAA认证' },
  { id: '8', name: '固件版本检查', category: '资产合规', checkType: 'inventory', severity: 'medium', description: '检测设备固件版本是否在支持范围内' },
];

defaultRules.forEach(r => {
  complianceRules.set(r.id, {
    ...r,
    enabled: true,
    expression: `check_${r.checkType}("${r.name}")`,
    createdAt: new Date(),
  } as any);
});

// 获取合规规则列表
complianceRoutes.get('/rules', authMiddleware, async (c) => {
  const category = c.req.query('category');
  
  let rules = Array.from(complianceRules.values());
  if (category) {
    rules = rules.filter(r => r.category === category);
  }

  return c.json({
    code: 0,
    data: rules,
  });
});

// 创建合规规则
complianceRoutes.post('/rules', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  name: z.string().min(1),
  category: z.string(),
  description: z.string().optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  checkType: z.enum(['config', 'security', 'performance', 'inventory']),
  expression: z.string().optional(),
})), async (c) => {
  const data = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const id = crypto.randomUUID();
    complianceRules.set(id, {
      id,
      ...data,
      enabled: true,
      expression: data.expression || '',
      createdAt: new Date(),
    } as any);

    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'create_compliance_rule',
      resource: 'compliance',
      details: JSON.stringify({ ruleId: id, name: data.name }),
    });

    return c.json({ code: 0, message: '规则创建成功', data: { id } });
  } catch (error) {
    return c.json({ code: 500, message: '创建失败' }, 500);
  }
});

// 启用/禁用规则
complianceRoutes.put('/rules/:id/toggle', authMiddleware, requireRole('admin'), async (c) => {
  const id = c.req.param('id');

  try {
    const rule = complianceRules.get(id);
    if (!rule) {
      return c.json({ code: 404, message: '规则不存在' }, 404);
    }

    rule.enabled = !rule.enabled;
    return c.json({ code: 0, message: rule.enabled ? '规则已启用' : '规则已禁用' });
  } catch (error) {
    return c.json({ code: 500, message: '操作失败' }, 500);
  }
});

// 执行合规检查
complianceRoutes.post('/scan', authMiddleware, requireRole('admin'), zValidator('json', z.object({
  deviceIds: z.array(z.string()).optional(),
  ruleIds: z.array(z.string()).optional(),
})), async (c) => {
  const { deviceIds, ruleIds } = c.req.valid('json');
  const currentUser = c.get('user');

  try {
    const devices = await db.select().from(schema.devices);
    const targetDevices = deviceIds?.length 
      ? devices.filter(d => deviceIds.includes(d.id))
      : devices;

    const rules = Array.from(complianceRules.values()).filter(r => r.enabled);
    const targetRules = ruleIds?.length 
      ? rules.filter(r => ruleIds.includes(r.id))
      : rules;

    // 模拟检查结果
    const results = [];
    for (const device of targetDevices) {
      for (const rule of targetRules) {
        const passed = Math.random() > 0.3; // 70%通过率
        results.push({
          deviceId: device.id,
          deviceName: device.name,
          ruleId: rule.id,
          ruleName: rule.name,
          category: rule.category,
          severity: rule.severity,
          passed,
          details: passed ? '检查通过' : `不符合规则: ${rule.description}`,
          checkedAt: new Date(),
        });
      }
    }

    const scanId = crypto.randomUUID();

    await db.insert(schema.auditLogs).values({
      userId: currentUser.userId,
      action: 'compliance_scan',
      resource: 'compliance',
      details: JSON.stringify({ 
        scanId, 
        deviceCount: targetDevices.length, 
        ruleCount: targetRules.length 
      }),
    });

    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;

    return c.json({
      code: 0,
      message: '合规检查完成',
      data: {
        scanId,
        summary: {
          totalChecks: results.length,
          passed: passedCount,
          failed: failedCount,
          passRate: Math.round(passedCount / results.length * 100),
        },
        results,
      },
    });
  } catch (error) {
    return c.json({ code: 500, message: '检查失败' }, 500);
  }
});

// 获取合规概览
complianceRoutes.get('/overview', authMiddleware, async (c) => {
  try {
    const devices = await db.select().from(schema.devices);
    const rules = Array.from(complianceRules.values());

    // 模拟统计数据
    const overview = {
      totalDevices: devices.length,
      compliantDevices: Math.floor(devices.length * 0.7),
      totalRules: rules.length,
      enabledRules: rules.filter(r => r.enabled).length,
      lastScanTime: new Date(Date.now() - 3600000),
      overallScore: Math.floor(Math.random() * 30) + 70,
      byCategory: [
        { category: '安全合规', total: 4, passed: 3, failed: 1 },
        { category: '配置合规', total: 3, passed: 2, failed: 1 },
        { category: '资产合规', total: 1, passed: 1, failed: 0 },
      ],
      bySeverity: [
        { severity: 'critical', total: 1, passed: 0, failed: 1 },
        { severity: 'high', total: 3, passed: 2, failed: 1 },
        { severity: 'medium', total: 3, passed: 3, failed: 0 },
        { severity: 'low', total: 1, passed: 1, failed: 0 },
      ],
    };

    return c.json({
      code: 0,
      data: overview,
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取概览失败' }, 500);
  }
});

// 获取不合规设备列表
complianceRoutes.get('/violations', authMiddleware, async (c) => {
  try {
    const devices = await db.select().from(schema.devices).limit(10);
    const rules = Array.from(complianceRules.values()).filter(r => r.enabled);

    const violations = [];
    for (const device of devices) {
      if (Math.random() > 0.7) {
        const rule = rules[Math.floor(Math.random() * rules.length)];
        if (rule) {
          violations.push({
            id: crypto.randomUUID(),
            deviceId: device.id,
            deviceName: device.name,
            deviceIp: device.ipAddress,
            ruleId: rule.id,
            ruleName: rule.name,
            category: rule.category,
            severity: rule.severity,
            description: rule.description,
            detectedAt: new Date(Date.now() - Math.random() * 86400000),
            status: Math.random() > 0.5 ? 'open' : 'acknowledged',
          });
        }
      }
    }

    return c.json({
      code: 0,
      data: violations,
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取违规列表失败' }, 500);
  }
});

// 获取合规报告
complianceRoutes.get('/report', authMiddleware, async (c) => {
  const period = c.req.query('period') || '7d';

  try {
    const trend = [];
    const days = period === '30d' ? 30 : period === '7d' ? 7 : 1;
    
    for (let i = days; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000);
      trend.push({
        date: date.toISOString().split('T')[0],
        score: Math.floor(Math.random() * 20) + 70,
        violations: Math.floor(Math.random() * 10),
      });
    }

    return c.json({
      code: 0,
      data: {
        period,
        trend,
        summary: {
          avgScore: 78,
          totalScans: 15,
          resolvedViolations: 23,
          pendingViolations: 7,
        },
      },
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取报告失败' }, 500);
  }
});

export { complianceRoutes };
