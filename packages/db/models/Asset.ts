import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IAsset extends Document {
  org_id: Types.ObjectId;
  name: string;
  kind: 'facility' | 'machinery' | 'inventory' | 'ip';
  location_geo: { lat: number; lng: number } | null;
  value_usd: number;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

const AssetSchema = new Schema<IAsset>({
  org_id:      { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  name:        { type: String, required: true },
  kind:        { type: String, enum: ['facility', 'machinery', 'inventory', 'ip'], required: true },
  location_geo: {
    type: new Schema({ lat: { type: Number, required: true }, lng: { type: Number, required: true } }, { _id: false }),
    default: null,
  },
  value_usd:   { type: Number, required: true, min: 0 },
  criticality: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
  active:      { type: Boolean, default: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

AssetSchema.index({ org_id: 1, active: 1 });
AssetSchema.index({ org_id: 1, kind: 1 });
AssetSchema.index({ org_id: 1, criticality: 1 });

export const Asset: Model<IAsset> =
  mongoose.models.Asset ?? mongoose.model<IAsset>('Asset', AssetSchema);
