import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type SeverityRuleCondition = 'event_kind' | 'event_kind+geo' | 'always';
export type SeverityRuleThreshold = 'low' | 'medium' | 'high' | 'critical';

export interface ISeverityRule extends Document {
  org_id: Types.ObjectId;
  entity_id: Types.ObjectId;
  condition_type: SeverityRuleCondition;
  event_kind: string | null;        // required when condition_type !== 'always'
  geo_country_code: string | null;  // required when condition_type === 'event_kind+geo'
  threshold: SeverityRuleThreshold;
  notification_channels: ('email' | 'whatsapp' | 'webhook')[];
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

const SeverityRuleSchema = new Schema<ISeverityRule>({
  org_id:     { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  entity_id:  { type: Schema.Types.ObjectId, ref: 'WatchlistEntity', required: true },
  condition_type: {
    type: String,
    enum: ['event_kind', 'event_kind+geo', 'always'],
    required: true,
  },
  event_kind:       { type: String, default: null },
  geo_country_code: { type: String, default: null, uppercase: true },
  threshold: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true,
  },
  notification_channels: {
    type: [String],
    enum: ['email', 'whatsapp', 'webhook'],
    default: [],
  },
  active: { type: Boolean, default: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

SeverityRuleSchema.index({ org_id: 1, entity_id: 1 });
SeverityRuleSchema.index({ org_id: 1, active: 1 });

export const SeverityRule: Model<ISeverityRule> =
  mongoose.models.SeverityRule ??
  mongoose.model<ISeverityRule>('SeverityRule', SeverityRuleSchema);
