import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IApiKey extends Document {
  org_id: Types.ObjectId;
  name: string;
  key_hash: string;
  key_prefix: string;
  scopes: ('read:events' | 'read:alerts' | 'write:watchlist')[];
  rate_limit_per_minute: number;
  created_by_user_id: Types.ObjectId;
  created_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
}

const ApiKeySchema = new Schema<IApiKey>({
  org_id:  { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  name:    { type: String, required: true },
  key_hash:   { type: String, required: true, unique: true },
  key_prefix: { type: String, required: true },
  scopes: { type: [String], default: ['read:events', 'read:alerts'] },
  rate_limit_per_minute: { type: Number, default: 100 },
  created_by_user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  last_used_at: { type: Date, default: null },
  revoked_at:   { type: Date, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

ApiKeySchema.index({ org_id: 1 });

export const ApiKey: Model<IApiKey> =
  mongoose.models.ApiKey ?? mongoose.model<IApiKey>('ApiKey', ApiKeySchema);
