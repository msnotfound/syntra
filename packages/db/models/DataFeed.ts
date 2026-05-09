import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDataFeed extends Document {
  feed_id: string;
  name: string;
  provider: string;
  cost_model: 'free' | 'freemium' | 'paid';
  active: boolean;
  last_sync_at: Date | null;
  last_sync_status: 'ok' | 'degraded' | 'failed';
  event_count_total: number;
  event_count_24h: number;
  created_at: Date;
  updated_at: Date;
}

const DataFeedSchema = new Schema<IDataFeed>(
  {
    feed_id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    provider: { type: String, required: true },
    cost_model: { type: String, enum: ['free', 'freemium', 'paid'], default: 'free' },
    active: { type: Boolean, default: true },
    last_sync_at: { type: Date, default: null },
    last_sync_status: { type: String, enum: ['ok', 'degraded', 'failed'], default: 'ok' },
    event_count_total: { type: Number, default: 0 },
    event_count_24h: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

DataFeedSchema.index({ active: 1 });

export const DataFeed: Model<IDataFeed> =
  mongoose.models.DataFeed ?? mongoose.model<IDataFeed>('DataFeed', DataFeedSchema);
