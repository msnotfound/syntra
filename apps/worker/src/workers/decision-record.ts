import { Queue, Worker } from 'bullmq';
import { connectDb, Decision } from '@syntra/db';
import type { DecisionType } from '@syntra/db';
import mongoose from 'mongoose';

const REDIS_URL = process.env.UPSTASH_REDIS_URL;
const connection = REDIS_URL
  ? { url: REDIS_URL }
  : { host: 'localhost', port: 6379 };

export interface DecisionJobData {
  org_id: string;
  alert_id: string;
  user_id: string;
  decision_type: DecisionType;
  decision_text: string;
  justification: string;
}

let queue: Queue | null = null;

export function getDecisionQueue(): Queue {
  if (!queue) queue = new Queue('decision-record', { connection });
  return queue;
}

export function startDecisionRecordWorker() {
  const worker = new Worker<DecisionJobData>('decision-record', async (job) => {
    const { org_id, alert_id, user_id, decision_type, decision_text, justification } = job.data;
    await connectDb();

    await Decision.create({
      org_id: new mongoose.Types.ObjectId(org_id),
      alert_id: new mongoose.Types.ObjectId(alert_id),
      user_id: new mongoose.Types.ObjectId(user_id),
      decision_type,
      decision_text,
      justification,
      made_at: new Date(),
    });
  }, { connection });

  worker.on('failed', (job, err) =>
    console.error('[decision-record] Job failed', job?.id, err.message),
  );

  return worker;
}
