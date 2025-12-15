import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
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
networkQualityRoutes.get('/overview', authMiddleware, async (c) => {
  const overview = {
    avgLatency: Math.floor(Math.random() * 20 + 15),
    avgJitter: Math.floor(Math.random() * 3 + 2),
    packetLoss: (Math.random() * 0.3).toFixed(2),
    availability: (99 + Math.random() * 0.9).toFixed(2),
    throughput: Math.floor(Math.random() * 500 + 800),
    activeProbes: 12,
    healthyLinks: 145,
    degradedLinks: 3,
    downLinks: 2,
  };

  return c.json({ code: 0, data: overview });
});

// 链路健康列表
networkQualityRoutes.get('/links', authMiddleware, async (c) => {
  const devices = await db.select().from(schema.devices).limit(10);

  const links = devices.map((d, i) => ({
    id: `link-${i}`,
    sourceDevice: d.name,
    sourceIp: d.ipAddress,
    targetDevice: `Core-Switch-${i + 1}`,
    targetIp: `10.0.0.${i + 1}`,
    latency: Math.floor(Math.random() * 30 + 5),
    jitter: Math.floor(Math.random() * 5 + 1),
    packetLoss: (Math.random() * 0.5).toFixed(2),
    bandwidth: Math.floor(Math.random() * 1000 + 100),
    status: Math.random() > 0.1 ? 'healthy' : 'degraded',
  }));

  return c.json({ code: 0, data: links });
});

// 单链路详情
networkQualityRoutes.get('/links/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');

  const linkDetail = {
    id,
    sourceDevice: 'Router-01',
    sourceIp: '192.168.1.1',
    targetDevice: 'Core-Switch-01',
    targetIp: '10.0.0.1',
    currentLatency: Math.floor(Math.random() * 30 + 10),
    avgLatency24h: Math.floor(Math.random() * 25 + 12),
    maxLatency24h: Math.floor(Math.random() * 50 + 30),
    jitter: Math.floor(Math.random() * 5 + 2),
    packetLoss: (Math.random() * 0.3).toFixed(2),
    availability24h: (99 + Math.random() * 0.9).toFixed(2),
    bandwidth: 1000,
    utilization: Math.floor(Math.random() * 60 + 20),
    trend: generateLatencyData(60),
  };

  return c.json({ code: 0, data: linkDetail });
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
  return c.json({
    code: 0,
    data: {
      target,
      duration,
      download: {
        speed: Math.floor(Math.random() * 500 + 500),
        unit: 'Mbps',
      },
      upload: {
        speed: Math.floor(Math.random() * 200 + 300),
        unit: 'Mbps',
      },
      latency: Math.floor(Math.random() * 10 + 5),
      jitter: Math.floor(Math.random() * 3 + 1),
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
networkQualityRoutes.get('/trends', authMiddleware, async (c) => {
  const range = c.req.query('range') || '24h';
  const points = range === '1h' ? 60 : range === '6h' ? 360 : 1440;

  return c.json({
    code: 0,
    data: {
      latency: generateLatencyData(Math.min(points, 100)),
      availability: Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        value: 99 + Math.random() * 0.9,
      })),
    },
  });
});

export { networkQualityRoutes };
