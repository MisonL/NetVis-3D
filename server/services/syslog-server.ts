import dgram from 'dgram';
import { db, schema } from '../db';

export class SyslogServer {
  private server: dgram.Socket;
  private port: number;

  constructor(port: number = 514) {
    this.server = dgram.createSocket('udp4');
    this.port = port;
  }

  start() {
      // Handle bind errors (e.g. permission denied on 514)
      this.server.on('error', (err) => {
          console.error(`Syslog server error:\n${err.stack}`);
          this.server.close();
      });

    this.server.on('message', async (msg, rinfo) => {
      try {
        const raw = msg.toString();
        // Parse PRI (<13>...)
        const priMatch = raw.match(/^<(\d+)>(.*)/);
        let priority = 13; // default user.notice
        let rest = raw;
        if (priMatch) {
            priority = parseInt(priMatch[1] || '13');
            rest = priMatch[2] || '';
        }
        const facility = Math.floor(priority / 8);
        const severity = priority % 8;

        // Extract Timestamp and Hostname if standard RFC format
        // Typical: "Dec 15 10:00:00 hostname app[pid]: message"
        // Or "2023-12-15T10:00:00Z hostname ..." (RFC5424)
        
        // We will default to Receive Time for simplicity unless regex matches clearly.
        // We use rinfo.address as fallback hostname if not found.

        await db.insert(schema.syslogMessages).values({
            facility,
            severity,
            priority,
            timestamp: new Date(), 
            hostname: rinfo.address, 
            message: rest.trim(),
            raw: raw,
        });

      } catch (e) {
        console.error('Syslog Insert Error:', e);
      }
    });

    try {
        this.server.bind(this.port, () => {
            console.log(`🚀 Syslog Server listening on UDP ${this.port}`);
        });
    } catch(e) {
        console.error('Failed to bind Syslog port:', e);
    }
  }

  stop() {
    this.server.close();
  }
}
