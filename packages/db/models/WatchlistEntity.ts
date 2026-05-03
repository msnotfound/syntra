import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IWatchlistEntity extends Document {
  org_id: Types.ObjectId;
  type: 'supplier' | 'port' | 'route' | 'country' | 'region' | 'asset';
  name: string;
  latitude: number | null;
  longitude: number | null;
  country_code: string | null;
  region: string | null;
  metadata: Record<string, unknown>;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

const WatchlistEntitySchema = new Schema<IWatchlistEntity>({
  org_id: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  type:   { type: String, enum: ['supplier','port','route','country','region','asset'], required: true },
  name:   { type: String, required: true },
  latitude:  { type: Number, default: null },
  longitude: { type: Number, default: null },
  country_code: { type: String, default: null, uppercase: true },
  region: { type: String, default: null },
  metadata: { type: Schema.Types.Mixed, default: {} },
  active: { type: Boolean, default: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

WatchlistEntitySchema.index({ org_id: 1, active: 1 });
WatchlistEntitySchema.index({ latitude: 1, longitude: 1 });
WatchlistEntitySchema.index({ country_code: 1 });
WatchlistEntitySchema.index({ org_id: 1, type: 1 });

export const WatchlistEntity: Model<IWatchlistEntity> =
  mongoose.models.WatchlistEntity ??
  mongoose.model<IWatchlistEntity>('WatchlistEntity', WatchlistEntitySchema);
