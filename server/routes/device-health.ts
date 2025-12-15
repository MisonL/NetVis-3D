import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc, count } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const deviceHealthRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 健康评分权重配置
const scoreWeights = {
  availability: 0.30,      // 可用性 30%
  performance: 0.25,       // 性能 25%
  reliability: 0.20,       // 可靠性 20%
  security: 0.15,          // 安全性 15%
  maintenance: 0.10,       // 维护状态 10%
};

// 计算设备健康评分
const calculateDeviceScore = (device: {
  status?: string;
  lastSeen?: Date | null;
  cpuUsage?: number;
  memoryUsage?: number;
  latency?: number;
  alertCount?: number;
  uptimePercent?: number;
}) => {
  const scores: Record<string, number> = {};

  // 可用性评分
  if (device.status === 'online') {
    scores.availability = 100;
  } else if (device.status === 'warning') {
    scores.availability = 60;
  } else {
    scores.availability = 0;
  }

  // 性能评分
  const cpuScore = Math.max(0, 100 - (device.cpuUsage || 0));
  const memScore = Math.max(0, 100 - (device.memoryUsage || 0));
  const latencyScore = device.latency ? Math.max(0, 100 - device.latency) : 80;
  scores.performance = (cpuScore + memScore + latencyScore) / 3;

  // 可靠性评分
  scores.reliability = device.uptimePercent || 95;

  // 安全性评分（基于告警数量）
  const alertPenalty = Math.min((device.alertCount || 0) * 10, 50);
  scores.security = 100 - alertPenalty;

  // 维护状态评分
  if (device.lastSeen) {
    const hoursSinceLastSeen = (Date.now() - new Date(device.lastSeen).getTime()) / 3600000;
    scores.maintenance = hoursSinceLastSeen < 1 ? 100 : Math.max(0, 100 - hoursSinceLastSeen * 5);
  } else {
    scores.maintenance = 50;
  }

  // 加权总分
  const totalScore = 
    scores.availability * scoreWeights.availability +
    scores.performance * scoreWeights.performance +
    scores.reliability * scoreWeights.reliability +
    scores.security * scoreWeights.security +
    scores.maintenance * scoreWeights.maintenance;

  return {
    total: Math.round(totalScore),
    breakdown: scores,
    grade: totalScore >= 90 ? 'A' : 
           totalScore >= 80 ? 'B' : 
           totalScore >= 70 ? 'C' : 
           totalScore >= 60 ? 'D' : 'F',
  };
};

// 获取单个设备健康评分
deviceHealthRoutes.get('/device/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');

  try {
    const [device] = await db
      .select()
      .from(schema.devices)
      .where(eq(schema.devices.id, id));

    if (!device) {
      return c.json({ code: 404, message: '设备不存在' }, 404);
    }

    // 获取告警数量
    const alertResult = await db
      .select({ count: count() })
      .from(schema.alerts)
      .where(eq(schema.alerts.deviceId, id));

    // 模拟性能指标
    const mockMetrics = {
      cpuUsage: Math.random() * 60 + 20,
      memoryUsage: Math.random() * 40 + 40,
      latency: Math.random() * 50 + 10,
      uptimePercent: 95 + Math.random() * 5,
    };

    const score = calculateDeviceScore({
      status: device.status || 'online',
      lastSeen: device.updatedAt,
      alertCount: alertResult[0]?.count || 0,
      ...mockMetrics,
    });

    return c.json({
      code: 0,
      data: {
        deviceId: id,
        deviceName: device.name,
        ...score,
        metrics: mockMetrics,
        recommendations: getRecommendations(score.breakdown),
      },
    });
  } catch (error) {
    console.error('Get device health error:', error);
    return c.json({ code: 500, message: '获取健康评分失败' }, 500);
  }
});

// 获取所有设备健康评分概览
deviceHealthRoutes.get('/overview', authMiddleware, async (c) => {
  try {
    const devices = await db.select().from(schema.devices);

    const scores = devices.map(device => {
      const mockMetrics = {
        cpuUsage: Math.random() * 60 + 20,
        memoryUsage: Math.random() * 40 + 40,
        latency: Math.random() * 50 + 10,
        uptimePercent: 95 + Math.random() * 5,
      };

      const score = calculateDeviceScore({
        status: device.status || 'online',
        lastSeen: device.updatedAt,
        alertCount: 0,
        ...mockMetrics,
      });

      return {
        deviceId: device.id,
        deviceName: device.name,
        type: device.type,
        status: device.status,
        score: score.total,
        grade: score.grade,
      };
    });

    // 统计
    const avgScore = scores.length ? 
      Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length) : 0;

    const gradeDistribution = {
      A: scores.filter(s => s.grade === 'A').length,
      B: scores.filter(s => s.grade === 'B').length,
      C: scores.filter(s => s.grade === 'C').length,
      D: scores.filter(s => s.grade === 'D').length,
      F: scores.filter(s => s.grade === 'F').length,
    };

    // 低健康评分设备
    const lowScoreDevices = scores
      .filter(s => s.score < 70)
      .sort((a, b) => a.score - b.score)
      .slice(0, 10);

    return c.json({
      code: 0,
      data: {
        totalDevices: devices.length,
        avgScore,
        gradeDistribution,
        lowScoreDevices,
        scores: scores.sort((a, b) => a.score - b.score),
      },
    });
  } catch (error) {
    console.error('Get health overview error:', error);
    return c.json({ code: 500, message: '获取健康概览失败' }, 500);
  }
});

// 获取健康趋势
deviceHealthRoutes.get('/trend', authMiddleware, async (c) => {
  const deviceId = c.req.query('deviceId');
  const days = parseInt(c.req.query('days') || '7');

  try {
    // 模拟趋势数据
    const trend = [];
    const now = Date.now();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now - i * 86400000);
      trend.push({
        date: date.toISOString().split('T')[0],
        score: 75 + Math.random() * 20,
        availability: 90 + Math.random() * 10,
        performance: 70 + Math.random() * 25,
      });
    }

    return c.json({
      code: 0,
      data: {
        deviceId,
        days,
        trend,
      },
    });
  } catch (error) {
    return c.json({ code: 500, message: '获取趋势失败' }, 500);
  }
});

// 生成优化建议
const getRecommendations = (breakdown: Record<string, number>): string[] => {
  const recommendations: string[] = [];

  if ((breakdown.availability || 0) < 80) {
    recommendations.push('建议检查网络连接和设备电源状态');
  }
  if ((breakdown.performance || 0) < 70) {
    recommendations.push('建议优化设备负载，考虑升级硬件配置');
  }
  if ((breakdown.reliability || 0) < 80) {
    recommendations.push('建议检查设备稳定性，排查重启原因');
  }
  if ((breakdown.security || 0) < 80) {
    recommendations.push('建议关注告警信息，及时处理安全事件');
  }
  if ((breakdown.maintenance || 0) < 70) {
    recommendations.push('建议定期维护设备，更新固件版本');
  }

  if (recommendations.length === 0) {
    recommendations.push('设备运行状态良好，请继续保持');
  }

  return recommendations;
};

// 批量获取设备健康评分
deviceHealthRoutes.post('/batch', authMiddleware, zValidator('json', z.object({
  deviceIds: z.array(z.string().uuid()),
})), async (c) => {
  const { deviceIds } = c.req.valid('json');

  try {
    const results = await Promise.all(
      deviceIds.map(async (id) => {
        const [device] = await db
          .select()
          .from(schema.devices)
          .where(eq(schema.devices.id, id));

        if (!device) return null;

        const mockMetrics = {
          cpuUsage: Math.random() * 60 + 20,
          memoryUsage: Math.random() * 40 + 40,
          latency: Math.random() * 50 + 10,
          uptimePercent: 95 + Math.random() * 5,
        };

        const score = calculateDeviceScore({
          status: device.status || 'online',
          lastSeen: device.updatedAt,
          alertCount: 0,
          ...mockMetrics,
        });

        return {
          deviceId: id,
          deviceName: device.name,
          score: score.total,
          grade: score.grade,
        };
      })
    );

    return c.json({
      code: 0,
      data: results.filter(Boolean),
    });
  } catch (error) {
    return c.json({ code: 500, message: '批量获取失败' }, 500);
  }
});

// 获取评分配置
deviceHealthRoutes.get('/config', authMiddleware, requireRole('admin'), async (c) => {
  return c.json({
    code: 0,
    data: {
      weights: scoreWeights,
      thresholds: {
        A: 90,
        B: 80,
        C: 70,
        D: 60,
      },
    },
  });
});

export { deviceHealthRoutes };
