import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IAlert extends Document {
  org_id: Types.ObjectId;
  event_id: Types.ObjectId;
  watchlist_entity_ids: Types.ObjectId[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  match_reasons: ('proximity' | 'country' | 'route' | 'supplier_country')[];
  event_snapshot: {
    title: string;
    description: string;
    location: { lat: number; lng: number };
    country: string;
    country_code: string;
    event_type: string;
    occurred_at: Date;
    sources: Array<{ url: string; name: string }>;
  };
  llm_context: {
    why_matters: string | null;
    recommended_actions: string[];
  };
  created_at: Date;
  dispatched_at: Date | null;
  channels_sent: ('email' | 'whatsapp' | 'webhook')[];
  acknowledged_at: Date | null;
  acknowledged_by_user_id: Types.ObjectId | null;
  acknowledgement_note: string | null;
}

const AlertSchema = new Schema<IAlert>({
  org_id:  { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  event_id: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  watchlist_entity_ids: [{ type: Schema.Types.ObjectId, ref: 'WatchlistEntity' }],
  severity: { type: String, enum: ['critical','high','medium','low'], required: true },
  match_reasons: [{ type: String, enum: ['proximity','country','route','supplier_country'] }],
  event_snapshot: {
    title: String,
    description: String,
    location: { lat: Number, lng: Number },
    country: String,
    country_code: String,
    event_type: String,
    occurred_at: Date,
    sources: [{ url: String, name: String }],
  },
  llm_context: {
    why_matters: { type: String, default: null },
    recommended_actions: { type: [String], default: [] },
  },
  dispatched_at: { type: Date, default: null },
  channels_sent: { type: [String], default: [] },
  acknowledged_at: { type: Date, default: null },
  acknowledged_by_user_id: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  acknowledgement_note: { type: String, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

AlertSchema.index({ org_id: 1, created_at: -1 });
AlertSchema.index({ event_id: 1, org_id: 1 }, { unique: true });
AlertSchema.index({ acknowledged_at: 1 });
AlertSchema.index({ org_id: 1, severity: 1 });

export const Alert: Model<IAlert> =
  mongoose.models.Alert ?? mongoose.model<IAlert>('Alert', AlertSchema);
