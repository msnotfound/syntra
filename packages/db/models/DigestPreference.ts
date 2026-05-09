import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type NotificationChannelId = 'email' | 'slack' | 'teams' | 'webhook' | 'sms';
export type NotificationFormat = 'summary' | 'full' | 'oneliner';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface IChannelConfig {
  channel_id: NotificationChannelId;
  destination_id: string;
  format: NotificationFormat;
  enabled: boolean;
}

export interface IDeliveryWindow {
  start_hour: number;
  end_hour: number;
  timezone: string;
}

export interface IDigestPreference extends Document {
  user_id: Types.ObjectId;
  org_id: Types.ObjectId;
  frequency: 'daily' | 'weekly' | 'monthly';
  channels: ('email' | 'whatsapp' | 'webhook')[];
  sections: ('alerts' | 'severity_heatmap' | 'watchlist_health' | 'var_summary')[];
  enabled: boolean;
  // M37 additions
  channel_configs: IChannelConfig[];
  delivery_window: IDeliveryWindow;
  priority_threshold: Severity;
  created_at: Date;
  updated_at: Date;
}

const ChannelConfigSchema = new Schema<IChannelConfig>({
  channel_id:     { type: String, enum: ['email', 'slack', 'teams', 'webhook', 'sms'], required: true },
  destination_id: { type: String, required: true },
  format:         { type: String, enum: ['summary', 'full', 'oneliner'], default: 'summary' },
  enabled:        { type: Boolean, default: true },
}, { _id: false });

const DeliveryWindowSchema = new Schema<IDeliveryWindow>({
  start_hour: { type: Number, min: 0, max: 23, default: 8 },
  end_hour:   { type: Number, min: 0, max: 23, default: 22 },
  timezone:   { type: String, default: 'Asia/Kolkata' },
}, { _id: false });

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
  enabled:            { type: Boolean, default: true },
  channel_configs:    { type: [ChannelConfigSchema], default: [] },
  delivery_window:    { type: DeliveryWindowSchema, default: () => ({ start_hour: 8, end_hour: 22, timezone: 'Asia/Kolkata' }) },
  priority_threshold: { type: String, enum: ['critical', 'high', 'medium', 'low', 'info'], default: 'high' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

DigestPreferenceSchema.index({ org_id: 1, user_id: 1 }, { unique: true });
DigestPreferenceSchema.index({ org_id: 1, frequency: 1, enabled: 1 });

export const DigestPreference: Model<IDigestPreference> =
  mongoose.models.DigestPreference ?? mongoose.model<IDigestPreference>('DigestPreference', DigestPreferenceSchema);
