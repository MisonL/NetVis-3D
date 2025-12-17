import { db, schema } from '../db';
import { eq, and, or } from 'drizzle-orm';

interface NeighborData {
  deviceId: string; // Helper device ID (from collector's perspective, or IP)
  deviceIp: string;
  neighbors: Array<{
    localPort: string;
    remotePort: string;
    remoteChassisId: string;
    remoteSystemName: string;
    remoteIp?: string;
    linkType: string;
  }>;
}

export class TopologyService {
  /**
   * Process topology data received from a collector
   */
  static async processTopologyData(data: NeighborData) {
    const { deviceIp, neighbors } = data;

    // 1. Find Source Device
    const [sourceDevice] = await db.select().from(schema.devices).where(eq(schema.devices.ipAddress, deviceIp)).limit(1);
    if (!sourceDevice) {
      console.warn(`Topology: Source device not found for IP ${deviceIp}`);
      return;
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const neighbor of neighbors) {
      // 2. Find Target Device
      // Try by Chassis ID (which might be MAC or specialized ID), or IP, or Name
      // For simplicity in this environment, we rely mostly on IP or Name matching if ChassisID fails.
      // Ideally, ChassisID (MAC) is the robust way.
      
      let targetDevice = null;

      // Try fuzzy match by IP if provided
      if (neighbor.remoteIp) {
         [targetDevice] = await db.select().from(schema.devices).where(eq(schema.devices.ipAddress, neighbor.remoteIp)).limit(1);
      }

      // Try match by name if IP failed
      if (!targetDevice && neighbor.remoteSystemName) {
         [targetDevice] = await db.select().from(schema.devices).where(eq(schema.devices.name, neighbor.remoteSystemName)).limit(1);
      }

      if (!targetDevice) {
         // Optionally: Auto-create discovered device?
         // For now, we skip if not managed.
         continue;
      }

      // 3. Create or Update Link
      // Check if link exists (bidirectional check?)
      // Usually topology links are directional in LLDP (A hears B). We can normalize to A->B.
      
      const [existingLink] = await db.select().from(schema.topologyLinks).where(
        and(
          eq(schema.topologyLinks.sourceId, sourceDevice.id),
          eq(schema.topologyLinks.targetId, targetDevice.id),
          eq(schema.topologyLinks.sourcePort, neighbor.localPort)
        )
      ).limit(1);

      if (existingLink) {
        // Update status
        await db.update(schema.topologyLinks).set({
          targetPort: neighbor.remotePort,
          status: 'up',
          updatedAt: new Date(),
        }).where(eq(schema.topologyLinks.id, existingLink.id));
        updatedCount++;
      } else {
        // Create new
        await db.insert(schema.topologyLinks).values({
          sourceId: sourceDevice.id,
          targetId: targetDevice.id,
          sourcePort: neighbor.localPort,
          targetPort: neighbor.remotePort,
          linkType: 'ethernet', // Default
          status: 'up',
        });
        createdCount++;
      }
    }

    return { createdCount, updatedCount };
  }
}
