import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import type { NotificationChannelId } from './DigestPreference.js';

export interface INotificationChannel extends Document {
  org_id: Types.ObjectId;
  user_id: Types.ObjectId;
  channel_type: NotificationChannelId;
  destination: string;
  verified: boolean;
  created_at: Date;
}

const NotificationChannelSchema = new Schema<INotificationChannel>({
  org_id:       { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  user_id:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
  channel_type: { type: String, enum: ['email', 'slack', 'teams', 'webhook', 'sms'], required: true },
  destination:  { type: String, required: true },
  verified:     { type: Boolean, default: false },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

NotificationChannelSchema.index({ org_id: 1, user_id: 1 });
NotificationChannelSchema.index({ org_id: 1, channel_type: 1, verified: 1 });

export const NotificationChannel: Model<INotificationChannel> =
  mongoose.models.NotificationChannel ??
  mongoose.model<INotificationChannel>('NotificationChannel', NotificationChannelSchema);
