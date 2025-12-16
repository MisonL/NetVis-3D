import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc, sql, avg, count } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import type { JwtPayload } from '../middleware/auth';

const networkQualityRoutes = new Hono<{
  Variables: {
    user: JwtPayload;
  };
}>();

// 生成模拟数据
const generateLatencyData = (points: number) => {
  const data = [];
  const now = Date.now();
  for (let i = points - 1; i >= 0; i--) {
    data.push({
      timestamp: new Date(now - i * 60000),
      latency: Math.floor(Math.random() * 30 + 10),
      jitter: Math.floor(Math.random() * 5 + 1),
      packetLoss: Math.random() * 0.5,
    });
  }
  return data;
};

// 网络质量概览
// 网络质量概览 (真实数据)
networkQualityRoutes.get('/overview', authMiddleware, async (c) => {
  try {
    // 1. 聚合性能指标 (过去5分钟)
    const metricsResult = await db.execute(sql`
      SELECT 
        AVG(latency)::numeric(10,2) as avg_latency,
        AVG(packet_loss)::numeric(10,2) as avg_loss,
        (COUNT(*) FILTER (WHERE status = 'online') * 100.0 / NULLIF(COUNT(*), 0))::numeric(10,2) as availability
      FROM ${schema.deviceMetrics}
      WHERE timestamp > NOW() - INTERVAL '5 minutes'
    `);
    // @ts-ignore
    const m = (metricsResult.rows || metricsResult)[0] || {};

    // 2. 统计链路状态
    const linksResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'up') as up_count,
        COUNT(*) FILTER (WHERE status = 'degraded') as degraded_count,
        COUNT(*) FILTER (WHERE status = 'down') as down_count
      FROM ${schema.topologyLinks}
    `);
    // @ts-ignore
    const l = (linksResult.rows || linksResult)[0] || {};

    // 3. 统计活跃探针 (在线设备数)
    const activeProbes = await db
      .select({ count: count() })
      .from(schema.devices)
      .where(eq(schema.devices.status, 'online'));

    const overview = {
      avgLatency: Number(m.avg_latency || 0),
      avgJitter: 0, // Jitter暂未采集
      packetLoss: Number(m.avg_loss || 0).toFixed(2),
      availability: Number(m.availability || 100).toFixed(2),
      throughput: 0, // 暂无吞吐量聚合
      activeProbes: activeProbes[0]?.count || 0,
      healthyLinks: Number(l.up_count || 0),
      degradedLinks: Number(l.degraded_count || 0),
      downLinks: Number(l.down_count || 0),
    };

    return c.json({ code: 0, data: overview });
  } catch (error) {
    console.error('Network overview error:', error);
    return c.json({ code: 500, message: '获取概览失败' }, 500);
  }
});

// 链路健康列表
// 链路健康列表 (基于TopologyLinks + Target Device Metrics)
networkQualityRoutes.get('/links', authMiddleware, async (c) => {
  try {
    const links = await db.query.topologyLinks.findMany({
      limit: 50,
      with: {}, 
    });
    
    // 手动Join设备信息和指标 (Drizzle relations未配置，手动查)
    // 批量获取设备信息
    const devices = await db.select().from(schema.devices);
    const deviceMap = new Map(devices.map(d => [d.id, d]));

    // 批量获取实时指标
    const metricsResult = await db.execute(sql`
      SELECT 
        device_id, 
        AVG(latency)::numeric(10,2) as latency,
        AVG(packet_loss)::numeric(10,2) as loss
      FROM ${schema.deviceMetrics}
      WHERE timestamp > NOW() - INTERVAL '5 minutes'
      GROUP BY device_id
    `);
    const metricsMap = new Map();
    // @ts-ignore
    (metricsResult.rows || metricsResult).forEach((row: any) => {
        metricsMap.set(row.device_id, row);
    });

    const result = links.map(link => {
        const source = deviceMap.get(link.sourceId);
        const target = deviceMap.get(link.targetId);
        const targetMetrics = metricsMap.get(link.targetId) || {}; // Assuming status depends on Target reachability

        return {
            id: link.id,
            sourceDevice: source?.name || 'Unknown',
            sourceIp: source?.ipAddress || '-',
            targetDevice: target?.name || 'Unknown',
            targetIp: target?.ipAddress || '-',
            latency: Number(targetMetrics.latency || 0),
            jitter: 0, // Not collected
            packetLoss: Number(targetMetrics.loss || 0).toFixed(2),
            bandwidth: link.bandwidth || 0,
            status: link.status === 'up' ? 'healthy' : 'degraded', // Simple mapping
        };
    });

    return c.json({ code: 0, data: result });
  } catch (error) {
    console.error('Get links error:', error);
    return c.json({ code: 500, message: '获取链路失败' }, 500);
  }
});

// 单链路详情
networkQualityRoutes.get('/links/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');

  try {
    // 获取链路信息
    const [link] = await db.select().from(schema.topologyLinks).where(eq(schema.topologyLinks.id, id)).limit(1);
    if (!link) {
      return c.json({ code: 404, message: '链路不存在' }, 404);
    }

    // 获取源和目标设备
    const devices = await db.select().from(schema.devices);
    const deviceMap = new Map(devices.map(d => [d.id, d]));
    const source = deviceMap.get(link.sourceId);
    const target = deviceMap.get(link.targetId);

    // 获取过去24小时的目标设备指标
    const metricsResult = await db.execute(sql`
      SELECT 
        AVG(latency)::numeric(10,2) as avg_latency,
        MAX(latency)::numeric(10,2) as max_latency,
        AVG(packet_loss)::numeric(10,2) as avg_loss
      FROM ${schema.deviceMetrics}
      WHERE device_id = ${link.targetId}
        AND timestamp > NOW() - INTERVAL '24 hours'
    `);
    // @ts-ignore
    const m = (metricsResult.rows || metricsResult)[0] || {};

    // 获取趋势数据（过去60分钟）
    const trendResult = await db.execute(sql`
      SELECT 
        time_bucket('1 minute', timestamp) as bucket,
        AVG(latency)::numeric(10,2) as latency,
        AVG(packet_loss)::numeric(10,2) as loss
      FROM ${schema.deviceMetrics}
      WHERE device_id = ${link.targetId}
        AND timestamp > NOW() - INTERVAL '1 hour'
      GROUP BY bucket
      ORDER BY bucket ASC
    `);
    // @ts-ignore
    const trend = (trendResult.rows || trendResult).map((row: any) => ({
      timestamp: new Date(row.bucket),
      latency: Number(row.latency || 0),
      jitter: 0,
      packetLoss: Number(row.loss || 0),
    }));

    const linkDetail = {
      id,
      sourceDevice: source?.name || 'Unknown',
      sourceIp: source?.ipAddress || '-',
      targetDevice: target?.name || 'Unknown',
      targetIp: target?.ipAddress || '-',
      currentLatency: Number(m.avg_latency || 0),
      avgLatency24h: Number(m.avg_latency || 0),
      maxLatency24h: Number(m.max_latency || 0),
      jitter: 0, // 未采集
      packetLoss: Number(m.avg_loss || 0).toFixed(2),
      availability24h: '99.9', // 可根据up/down时间计算
      bandwidth: link.bandwidth || 1000,
      utilization: 0, // 未采集
      trend: trend.length > 0 ? trend : [], // 如无实际数据返回空
    };

    return c.json({ code: 0, data: linkDetail });
  } catch (error) {
    console.error('Get link detail error:', error);
    return c.json({ code: 500, message: '获取链路详情失败' }, 500);
  }
});

// Ping测试
networkQualityRoutes.post('/ping', authMiddleware, zValidator('json', z.object({
  target: z.string(),
  count: z.number().optional().default(4),
})), async (c) => {
  const { target, count } = c.req.valid('json');

  try {
    // 使用系统ping命令
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // 根据操作系统选择ping命令格式
    const isWindows = process.platform === 'win32';
    const pingCmd = isWindows
      ? `ping -n ${count} ${target}`
      : `ping -c ${count} ${target}`;

    const { stdout } = await execAsync(pingCmd, { timeout: 30000 });

    // 解析ping输出
    const results: { seq: number; ttl: number; time: number }[] = [];
    const lines = stdout.split('\n');

    for (const line of lines) {
      // 匹配格式: 64 bytes from x.x.x.x: icmp_seq=1 ttl=64 time=1.23 ms
      const match = line.match(/icmp_seq[=:](\d+).*ttl[=:](\d+).*time[=:]?([\d.]+)/i);
      if (match) {
        results.push({
          seq: parseInt(match[1] || '0'),
          ttl: parseInt(match[2] || '0'),
          time: parseFloat(match[3] || '0'),
        });
      }
    }

    // 解析统计信息
    const statsMatch = stdout.match(/(\d+) packets transmitted.*?(\d+) (?:packets )?received.*?(\d+(?:\.\d+)?)[%]/);
    const transmitted = statsMatch ? parseInt(statsMatch[1] || '0') : count;
    const received = statsMatch ? parseInt(statsMatch[2] || '0') : results.length;
    const loss = statsMatch ? parseFloat(statsMatch[3] || '0') : (count - results.length) / count * 100;

    const times = results.map(r => r.time);
    const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;

    return c.json({
      code: 0,
      data: {
        target,
        count,
        results,
        stats: {
          transmitted,
          received,
          loss,
          min: times.length > 0 ? Math.min(...times) : 0,
          max: times.length > 0 ? Math.max(...times) : 0,
          avg: avgTime.toFixed(1),
        },
      },
    });
  } catch (error) {
    console.error('Ping error:', error);
    return c.json({
      code: 0,
      data: {
        target,
        count,
        results: [],
        stats: { transmitted: count, received: 0, loss: 100, min: 0, max: 0, avg: '0' },
        error: '目标不可达或ping超时',
      },
    });
  }
});

// Traceroute测试
networkQualityRoutes.post('/traceroute', authMiddleware, zValidator('json', z.object({
  target: z.string(),
})), async (c) => {
  const { target } = c.req.valid('json');

  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // 根据操作系统选择命令
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? `tracert -d ${target}` : `traceroute -n ${target}`;

    const { stdout } = await execAsync(cmd, { timeout: 60000 });

    // 解析traceroute输出
    const hops: { hop: number; ip: string; hostname: string; time: number[] }[] = [];
    const lines = stdout.split('\n');

    for (const line of lines) {
      // 匹配格式: 1  192.168.1.1  1.234 ms  1.456 ms  1.789 ms
      const match = line.match(/^\s*(\d+)\s+([\d.]+|[*])\s+([\d.]+)\s*ms/);
      if (match) {
        const hop = parseInt(match[1] || '0');
        const ip = match[2] || '*';
        // 提取所有时间值
        const timeMatches = line.match(/([\d.]+)\s*ms/g);
        const times = timeMatches ? timeMatches.map(t => parseFloat(t)) : [];

        hops.push({
          hop,
          ip: ip === '*' ? '* * *' : ip,
          hostname: ip,
          time: times,
        });
      }
    }

    return c.json({ code: 0, data: { target, hops } });
  } catch (error) {
    console.error('Traceroute error:', error);
    return c.json({
      code: 0,
      data: {
        target,
        hops: [],
        error: 'Traceroute执行失败或超时',
      },
    });
  }
});

// 带宽测试
networkQualityRoutes.post('/bandwidth-test', authMiddleware, zValidator('json', z.object({
  target: z.string(),
  duration: z.number().optional().default(10),
})), async (c) => {
  const { target, duration } = c.req.valid('json');

  // 模拟带宽测试结果
  // Placeholder for real iperf/speedtest execution
  return c.json({
    code: 0,
    data: {
      target,
      duration,
      download: { speed: 0, unit: 'Mbps' },
      upload: { speed: 0, unit: 'Mbps' },
      latency: 0,
      jitter: 0,
      note: 'Bandwidth test requires agent integration'
    },
  });
});

// 获取告警阈值配置
networkQualityRoutes.get('/thresholds', authMiddleware, async (c) => {
  const thresholds = {
    latency: { warning: 50, critical: 100 },
    jitter: { warning: 10, critical: 30 },
    packetLoss: { warning: 1, critical: 5 },
    availability: { warning: 99, critical: 95 },
  };

  return c.json({ code: 0, data: thresholds });
});

// 获取网络质量历史趋势
// 获取网络质量历史趋势 (Real)
networkQualityRoutes.get('/trends', authMiddleware, async (c) => {
  const range = c.req.query('range') || '24h';
  const interval = range === '1h' ? '1 minute' : range === '6h' ? '5 minutes' : '15 minutes';
  const days = range === '1h' ? 0.04 : range === '6h' ? 0.25 : 1; 

  try {
     const historyResult = await db.execute(sql`
      SELECT 
        time_bucket(${sql.raw(`'${interval}'`)}, timestamp) as bucket,
        AVG(latency)::numeric(10,2) as latency,
        AVG(packet_loss)::numeric(10,2) as loss,
        (COUNT(*) FILTER (WHERE status = 'online') * 100.0 / NULLIF(COUNT(*), 0))::numeric(10,2) as availability
      FROM ${schema.deviceMetrics}
      WHERE timestamp > NOW() - INTERVAL '${sql.raw(days.toString())} days'
      GROUP BY bucket
      ORDER BY bucket ASC
    `);
    
    const latencyData = ((historyResult as any).rows || historyResult).map((row: any) => ({
      time: row.bucket,
      value: Number(row.latency),
    }));

    const lossData = ((historyResult as any).rows || historyResult).map((row: any) => ({
      time: row.bucket,
      value: Number(row.loss),
    }));

    const availabilityData = ((historyResult as any).rows || historyResult).map((row: any) => ({
        hour: new Date(row.bucket).getHours(), // Simplified, actually depends on point
        timestamp: new Date(row.bucket),
        value: Number(row.availability || 100)
    }));

    return c.json({
        code: 0,
        data: {
            latency: latencyData,
            availability: availabilityData
        }
    });

  } catch (error) {
     console.error('Trends error:', error);
     return c.json({ code: 500, message: '获取趋势失败' }, 500);
  }
});

export { networkQualityRoutes };
