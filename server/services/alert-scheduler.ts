import { db, schema } from '../db';
import { sql } from 'drizzle-orm';
import { getAlertEngine } from './alert-engine';

const EVALUATION_INTERVAL_MS = 60000; // 1 minute

export class AlertScheduler {
    private timer: NodeJS.Timeout | null = null;
    private isRunning = false;

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('[AlertScheduler] Starting alert scheduler...');
        
        // Initial run
        await this.runEvaluation();

        this.timer = setInterval(async () => {
            await this.runEvaluation();
        }, EVALUATION_INTERVAL_MS);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.isRunning = false;
        console.log('[AlertScheduler] Stopped.');
    }

    async runEvaluation() {
        try {
            console.log('[AlertScheduler] Running evaluation...');
            const engine = await getAlertEngine();
            await engine.loadRules();

            // 1. Get Latest Metrics Snapshot
            // Query metrics and join with devices for hostname
            const latestMetrics = await db.execute(sql`
                SELECT DISTINCT ON (dm.device_id)
                    dm.device_id,
                    d.name as device_name,
                    d.status as device_status,
                    dm.cpu_usage,
                    dm.memory_usage,
                    dm.latency,
                    dm.packet_loss,
                    dm.status as status_val,
                    dm.timestamp
                FROM device_metrics dm
                LEFT JOIN devices d ON dm.device_id = d.id
                WHERE dm.timestamp > NOW() - INTERVAL '5 minutes'
                ORDER BY dm.device_id, dm.timestamp DESC
            `);
            
            // Map rows to AlertEngine DeviceMetrics format
            // @ts-ignore
            const deviceMetricsList = (latestMetrics.rows || latestMetrics).map((row: any) => ({
                deviceId: row.device_id,
                deviceName: row.device_name || 'Unknown',
                cpuUsage: Number(row.cpu_usage || 0),
                memoryUsage: Number(row.memory_usage || 0),
                diskUsage: Number(row.disk_usage || 0),
                latency: Number(row.latency || 0),
                packetLoss: Number(row.packet_loss || 0),
                status: row.status_val !== null ? (row.status_val === 0 ? 'offline' : 'online') : (row.device_status || 'offline'),
                timestamp: new Date(row.timestamp)
            }));

            if (deviceMetricsList.length > 0) {
                 await engine.processMetricsBatch(deviceMetricsList);
            }

        } catch (error) {
            console.error('[AlertScheduler] Error evaluating alerts:', error);
        }
    }
}

export const alertScheduler = new AlertScheduler();
