import mongoose, { Schema, Document, Model } from 'mongoose';

// Read-only mirror of existing Warfront events collection.
// We only READ from this collection — never write.
export interface IEvent extends Document {
  title: string;
  description: string;
  location: { lat: number; lng: number };
  country: string;
  country_code: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  event_type: string;
  sources: Array<{ url: string; name: string }>;
  occurred_at: Date;
  created_at: Date;
  updated_at: Date;
}

const EventSchema = new Schema<IEvent>({
  title: String,
  description: String,
  location: {
    lat: Number,
    lng: Number,
  },
  country: String,
  country_code: { type: String, uppercase: true },
  severity: { type: String, enum: ['critical','high','medium','low','info'] },
  event_type: String,
  sources: [{ url: String, name: String }],
  occurred_at: Date,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

EventSchema.index({ created_at: -1 });
EventSchema.index({ country_code: 1 });
EventSchema.index({ 'location.lat': 1, 'location.lng': 1 });
EventSchema.index({ severity: 1 });

export const Event: Model<IEvent> =
  mongoose.models.Event ?? mongoose.model<IEvent>('Event', EventSchema);
