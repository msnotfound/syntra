import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IDigestPreference extends Document {
  user_id: Types.ObjectId;
  org_id: Types.ObjectId;
  frequency: 'daily' | 'weekly' | 'monthly';
  channels: ('email' | 'whatsapp' | 'webhook')[];
  sections: ('alerts' | 'severity_heatmap' | 'watchlist_health' | 'var_summary')[];
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

const DigestPreferenceSchema = new Schema<IDigestPreference>({
  user_id:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  org_id:    { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'daily' },
  channels:  { type: [String], enum: ['email', 'whatsapp', 'webhook'], default: ['email'] },
  sections: {
    type: [String],
    enum: ['alerts', 'severity_heatmap', 'watchlist_health', 'var_summary'],
    default: ['alerts', 'severity_heatmap', 'watchlist_health'],
  },
  enabled: { type: Boolean, default: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

DigestPreferenceSchema.index({ org_id: 1, user_id: 1 }, { unique: true });
DigestPreferenceSchema.index({ org_id: 1, frequency: 1, enabled: 1 });

export const DigestPreference: Model<IDigestPreference> =
  mongoose.models.DigestPreference ?? mongoose.model<IDigestPreference>('DigestPreference', DigestPreferenceSchema);
