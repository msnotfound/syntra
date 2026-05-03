import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IUsageEvent extends Document {
  org_id: Types.ObjectId;
  type: 'alert_sent' | 'api_call' | 'watchlist_added';
  metadata: Record<string, unknown>;
  created_at: Date;
}

const UsageEventSchema = new Schema<IUsageEvent>({
  org_id: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  type:   { type: String, enum: ['alert_sent','api_call','watchlist_added'], required: true },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

UsageEventSchema.index({ org_id: 1, created_at: -1 });
UsageEventSchema.index({ type: 1, created_at: -1 });

export const UsageEvent: Model<IUsageEvent> =
  mongoose.models.UsageEvent ?? mongoose.model<IUsageEvent>('UsageEvent', UsageEventSchema);
