import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type CustomSourceType = 'telegram' | 'discord' | 'rss-private' | 'webhook' | 'csv-upload';
export type CustomSourceStatus = 'active' | 'paused' | 'failed';

export interface CustomSourceConfig {
  // RSS / HTTP feeds
  url?: string | null;
  auth_type?: 'none' | 'bearer' | 'basic' | null;
  auth_token_enc?: string | null;   // AES-256 encrypted
  schedule_cron?: string | null;
  // Webhook signature validation
  signing_secret_enc?: string | null;   // AES-256 encrypted
  // Telegram/Discord (feature-flagged — not active by default)
  bot_token_enc?: string | null;
  channel_id?: string | null;
  server_id?: string | null;
  channel_ids?: string[] | null;
}

export interface ICustomSource extends Document {
  org_id: Types.ObjectId;
  name: string;
  source_type: CustomSourceType;
  config: CustomSourceConfig;
  status: CustomSourceStatus;
  last_polled_at: Date | null;
  error_count: number;
  created_at: Date;
  updated_at: Date;
}

const CustomSourceSchema = new Schema<ICustomSource>(
  {
    org_id:         { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name:           { type: String, required: true },
    source_type:    { type: String, enum: ['telegram', 'discord', 'rss-private', 'webhook', 'csv-upload'], required: true },
    config:         { type: Schema.Types.Mixed, default: {} },
    status:         { type: String, enum: ['active', 'paused', 'failed'], default: 'active' },
    last_polled_at: { type: Date, default: null },
    error_count:    { type: Number, default: 0 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

CustomSourceSchema.index({ org_id: 1, status: 1 });
CustomSourceSchema.index({ status: 1, source_type: 1 });

export const CustomSource: Model<ICustomSource> =
  mongoose.models.CustomSource ??
  mongoose.model<ICustomSource>('CustomSource', CustomSourceSchema);
