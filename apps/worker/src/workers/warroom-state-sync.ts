import { Queue, Worker } from 'bullmq';
import { connectDb, WarRoom, WarRoomMessage, Alert } from '@syntra/db';

const REDIS_URL = process.env.UPSTASH_REDIS_URL;
const connection = REDIS_URL
  ? { url: REDIS_URL }
  : { host: 'localhost', port: 6379 };

let queue: Queue | null = null;

export interface WarRoomStateSyncJobData {
  warRoomId: string;
  newStatus: 'open' | 'closed';
}

export function getWarRoomStateSyncQueue(): Queue {
  if (!queue) queue = new Queue('warroom-state-sync', { connection });
  return queue;
}

export async function syncWarRoomState({ warRoomId, newStatus }: WarRoomStateSyncJobData): Promise<void> {
  const room = await WarRoom.findById(warRoomId).lean();
  if (!room || !room.alert_id) return;

  const alert = await Alert.findById(room.alert_id).lean();
  if (!alert) return;

  if (newStatus === 'open' && alert.status === 'open') {
    await Alert.updateOne({ _id: alert._id }, { status: 'triaged' });
    return;
  }

  if (newStatus === 'closed' && alert.status !== 'closed') {
    await Alert.updateOne({ _id: alert._id }, { status: 'closed' });

    await WarRoomMessage.create({
      war_room_id: room._id,
      user_id:     room.created_by,
      body:        'Alert marked resolved. Consider closing this war room.',
      msg_type:    'system',
      attachments: [],
    });
  }
}

export function startWarRoomStateSyncWorker(): Worker {
  const worker = new Worker<WarRoomStateSyncJobData>('warroom-state-sync', async (job) => {
    await connectDb();
    await syncWarRoomState(job.data);
  }, { connection });

  worker.on('failed', (job, err) =>
    console.error('[warroom-state-sync] Job failed', job?.id, err.message),
  );

  return worker;
}
