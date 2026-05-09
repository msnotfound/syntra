import { Queue, Worker } from 'bullmq';
import { connectDb, Alert, WatchlistEntity, SupplierLink } from '@syntra/db';
import type { IAlert } from '@syntra/db';
import { Types } from 'mongoose';

const REDIS_URL = process.env.UPSTASH_REDIS_URL;
const connection = REDIS_URL
  ? { url: REDIS_URL }
  : { host: 'localhost', port: 6379 };

const MAX_TIER = 3;

let queue: Queue | null = null;

export function getGraphPropagateQueue(): Queue {
  if (!queue) queue = new Queue('graph-propagate', { connection });
  return queue;
}

export function startGraphPropagateWorker() {
  const worker = new Worker('graph-propagate', async (job) => {
    const { alertId } = job.data as { alertId: string };
    await connectDb();

    const alert = await Alert.findById(alertId).lean() as IAlert | null;
    if (!alert) return;

    const directEntityIds = alert.watchlist_entity_ids.map(String);
    if (directEntityIds.length === 0) return;

    // Walk upstream (child → parent) through SupplierLink to find tier-2 and tier-3 ancestors
    const affected = new Map<string, { depth: number; entityId: Types.ObjectId }>();

    const queue: Array<{ id: string; depth: number }> = directEntityIds.map(id => ({ id, depth: 0 }));
    const visited = new Set<string>(directEntityIds);

    while (queue.length > 0) {
      const item = queue.shift()!;
      if (item.depth >= MAX_TIER) continue;

      // Find parent entities linked to this child
      const links = await SupplierLink.find({
        org_id: alert.org_id,
        child_entity_id: new Types.ObjectId(item.id),
      }).lean();

      for (const link of links) {
        const parentId = String(link.parent_entity_id);
        if (visited.has(parentId)) continue;

        visited.add(parentId);
        affected.set(parentId, { depth: item.depth + 1, entityId: link.parent_entity_id });
        queue.push({ id: parentId, depth: item.depth + 1 });
      }
    }

    if (affected.size === 0) return;

    // Check which ancestors are on *any* org's watchlist
    const affectedIds = Array.from(affected.values()).map(a => a.entityId);
    const watchlistEntities = await WatchlistEntity.find({
      _id: { $in: affectedIds },
      org_id: alert.org_id,
      active: true,
    }).lean();

    if (watchlistEntities.length === 0) return;

    const propagatedEntityIds = watchlistEntities.map(e => e._id);

    // Create a propagation alert for each org that has these entities
    // We update the existing alert to include propagated entities (additive)
    const currentIds = new Set(alert.watchlist_entity_ids.map(String));
    const newIds = propagatedEntityIds.filter(id => !currentIds.has(String(id)));

    if (newIds.length === 0) return;

    await Alert.updateOne(
      { _id: alert._id },
      {
        $addToSet: { watchlist_entity_ids: { $each: newIds } },
        $set: { updated_at: new Date() },
      },
    );

    console.log(`[graph-propagate] Alert ${alertId}: propagated to ${newIds.length} upstream entities (tier-2/3)`);
  }, { connection });

  worker.on('failed', (job, err) =>
    console.error('[graph-propagate] Job failed', job?.id, err.message),
  );
  return worker;
}
