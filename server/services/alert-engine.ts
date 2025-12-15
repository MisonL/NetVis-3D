/**
 * 告警规则引擎
 * 用于评估设备指标并生成告警
 */

import { db, schema } from '../db';
import { eq, and, gte, lte } from 'drizzle-orm';

/**
 * 告警严重级别
 */
export type AlertSeverity = 'info' | 'warning' | 'critical';

/**
 * 告警规则类型
 */
export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  threshold: number;
  severity: AlertSeverity;
  duration?: number; // 持续时间（秒），超过此时间才触发告警
  enabled: boolean;
}

/**
 * 设备指标数据
 */
export interface DeviceMetrics {
  deviceId: string;
  deviceName: string;
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  latency?: number;
  packetLoss?: number;
  status?: string;
  timestamp: Date;
}

/**
 * 告警事件
 */
export interface AlertEvent {
  ruleId: string;
  ruleName: string;
  deviceId: string;
  deviceName: string;
  metric: string;
  currentValue: number;
  threshold: number;
  severity: AlertSeverity;
  message: string;
  timestamp: Date;
}

/**
 * 告警抑制记录
 */
const alertSuppressionMap = new Map<string, Date>();
const SUPPRESSION_DURATION = 5 * 60 * 1000; // 5分钟抑制

/**
 * 告警引擎类
 */
export class AlertEngine {
  private rules: AlertRule[] = [];

  /**
   * 加载告警规则
   */
  async loadRules(): Promise<void> {
    try {
      const dbRules = await db
        .select()
        .from(schema.alertRules)
        .where(eq(schema.alertRules.isEnabled, true));

      this.rules = dbRules.map((r) => {
        // 从conditions JSON字段解析规则参数
        let conditions: { metric?: string; operator?: string; threshold?: number; duration?: number } = {};
        try {
          conditions = JSON.parse(r.conditions || '{}');
        } catch {
          conditions = {};
        }

        return {
          id: r.id,
          name: r.name,
          metric: conditions.metric || 'cpuUsage',
          operator: (conditions.operator as AlertRule['operator']) || '>',
          threshold: conditions.threshold || 80,
          severity: (r.severity as AlertSeverity) || 'warning',
          duration: conditions.duration || 0,
          enabled: r.isEnabled ?? true,
        };
      });

      console.log(`[AlertEngine] Loaded ${this.rules.length} alert rules`);
    } catch (error) {
      console.error('[AlertEngine] Failed to load rules:', error);
      // 使用默认规则
      this.rules = this.getDefaultRules();
    }
  }

  /**
   * 获取默认告警规则
   */
  private getDefaultRules(): AlertRule[] {
    return [
      {
        id: 'default-cpu-warning',
        name: 'CPU使用率警告',
        metric: 'cpuUsage',
        operator: '>',
        threshold: 80,
        severity: 'warning',
        enabled: true,
      },
      {
        id: 'default-cpu-critical',
        name: 'CPU使用率严重',
        metric: 'cpuUsage',
        operator: '>',
        threshold: 95,
        severity: 'critical',
        enabled: true,
      },
      {
        id: 'default-memory-warning',
        name: '内存使用率警告',
        metric: 'memoryUsage',
        operator: '>',
        threshold: 85,
        severity: 'warning',
        enabled: true,
      },
      {
        id: 'default-memory-critical',
        name: '内存使用率严重',
        metric: 'memoryUsage',
        operator: '>',
        threshold: 95,
        severity: 'critical',
        enabled: true,
      },
      {
        id: 'default-latency-warning',
        name: '网络延迟警告',
        metric: 'latency',
        operator: '>',
        threshold: 100,
        severity: 'warning',
        enabled: true,
      },
      {
        id: 'default-packet-loss',
        name: '丢包率告警',
        metric: 'packetLoss',
        operator: '>',
        threshold: 5,
        severity: 'critical',
        enabled: true,
      },
      {
        id: 'default-device-offline',
        name: '设备离线',
        metric: 'status',
        operator: '==',
        threshold: 0, // 0 表示 offline
        severity: 'critical',
        enabled: true,
      },
    ];
  }

  /**
   * 评估单个规则
   */
  private evaluateRule(rule: AlertRule, metrics: DeviceMetrics): boolean {
    const value = this.getMetricValue(metrics, rule.metric);
    if (value === undefined) return false;

    switch (rule.operator) {
      case '>':
        return value > rule.threshold;
      case '<':
        return value < rule.threshold;
      case '>=':
        return value >= rule.threshold;
      case '<=':
        return value <= rule.threshold;
      case '==':
        return value === rule.threshold;
      case '!=':
        return value !== rule.threshold;
      default:
        return false;
    }
  }

  /**
   * 获取指标值
   */
  private getMetricValue(metrics: DeviceMetrics, metricName: string): number | undefined {
    switch (metricName) {
      case 'cpuUsage':
        return metrics.cpuUsage;
      case 'memoryUsage':
        return metrics.memoryUsage;
      case 'diskUsage':
        return metrics.diskUsage;
      case 'latency':
        return metrics.latency;
      case 'packetLoss':
        return metrics.packetLoss;
      case 'status':
        return metrics.status === 'offline' ? 0 : 1;
      default:
        return undefined;
    }
  }

  /**
   * 检查告警抑制
   */
  private isAlertSuppressed(deviceId: string, ruleId: string): boolean {
    const key = `${deviceId}:${ruleId}`;
    const lastAlert = alertSuppressionMap.get(key);
    
    if (lastAlert) {
      const elapsed = Date.now() - lastAlert.getTime();
      if (elapsed < SUPPRESSION_DURATION) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 记录告警抑制
   */
  private recordAlertSuppression(deviceId: string, ruleId: string): void {
    const key = `${deviceId}:${ruleId}`;
    alertSuppressionMap.set(key, new Date());
  }

  /**
   * 评估设备指标
   */
  async evaluateMetrics(metrics: DeviceMetrics): Promise<AlertEvent[]> {
    const alerts: AlertEvent[] = [];

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      const triggered = this.evaluateRule(rule, metrics);
      
      if (triggered && !this.isAlertSuppressed(metrics.deviceId, rule.id)) {
        const value = this.getMetricValue(metrics, rule.metric) ?? 0;
        
        const alert: AlertEvent = {
          ruleId: rule.id,
          ruleName: rule.name,
          deviceId: metrics.deviceId,
          deviceName: metrics.deviceName,
          metric: rule.metric,
          currentValue: value,
          threshold: rule.threshold,
          severity: rule.severity,
          message: this.buildAlertMessage(rule, metrics, value),
          timestamp: new Date(),
        };

        alerts.push(alert);
        this.recordAlertSuppression(metrics.deviceId, rule.id);
      }
    }

    return alerts;
  }

  /**
   * 构建告警消息
   */
  private buildAlertMessage(
    rule: AlertRule,
    metrics: DeviceMetrics,
    value: number
  ): string {
    const metricLabels: Record<string, string> = {
      cpuUsage: 'CPU使用率',
      memoryUsage: '内存使用率',
      diskUsage: '磁盘使用率',
      latency: '网络延迟',
      packetLoss: '丢包率',
      status: '设备状态',
    };

    const metricLabel = metricLabels[rule.metric] || rule.metric;
    const unit = rule.metric === 'latency' ? 'ms' : '%';

    if (rule.metric === 'status') {
      return `设备 ${metrics.deviceName} 已离线`;
    }

    return `设备 ${metrics.deviceName} 的${metricLabel}为 ${value.toFixed(1)}${unit}，超过阈值 ${rule.threshold}${unit}`;
  }

  /**
   * 保存告警到数据库
   */
  async saveAlert(alert: AlertEvent): Promise<void> {
    try {
      // 只有当ruleId是有效UUID时才保存（默认规则的ID不是UUID格式）
      const ruleIdValue = alert.ruleId.startsWith('default-') ? undefined : alert.ruleId;
      
      await db.insert(schema.alerts).values({
        deviceId: alert.deviceId,
        severity: alert.severity,
        message: alert.message,
        status: 'pending',
        ruleId: ruleIdValue,
        details: JSON.stringify({
          ruleName: alert.ruleName,
          metric: alert.metric,
          currentValue: alert.currentValue,
          threshold: alert.threshold,
          deviceName: alert.deviceName,
        }),
      });
    } catch (error) {
      console.error('[AlertEngine] Failed to save alert:', error);
    }
  }

  /**
   * 批量处理设备指标
   */
  async processMetricsBatch(metricsList: DeviceMetrics[]): Promise<AlertEvent[]> {
    const allAlerts: AlertEvent[] = [];

    for (const metrics of metricsList) {
      const alerts = await this.evaluateMetrics(metrics);
      
      for (const alert of alerts) {
        await this.saveAlert(alert);
        allAlerts.push(alert);
      }
    }

    console.log(`[AlertEngine] Processed ${metricsList.length} devices, generated ${allAlerts.length} alerts`);
    return allAlerts;
  }
}

// 单例实例
let alertEngineInstance: AlertEngine | null = null;

/**
 * 获取告警引擎实例
 */
export async function getAlertEngine(): Promise<AlertEngine> {
  if (!alertEngineInstance) {
    alertEngineInstance = new AlertEngine();
    await alertEngineInstance.loadRules();
  }
  return alertEngineInstance;
}

/**
 * 重新加载告警规则
 */
export async function reloadAlertRules(): Promise<void> {
  if (alertEngineInstance) {
    await alertEngineInstance.loadRules();
  }
}
