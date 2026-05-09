import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type ShipmentStatus = 'draft' | 'in_transit' | 'delivered' | 'cancelled';

export interface IShipment extends Document {
  org_id: Types.ObjectId;
  ref: string;
  origin_entity_id: Types.ObjectId;
  destination_entity_id: Types.ObjectId;
  route_polyline: Array<{ lat: number; lng: number }>;
  status: ShipmentStatus;
  eta_at: Date | null;
  value_usd: number;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

const CoordSchema = new Schema({ lat: { type: Number, required: true }, lng: { type: Number, required: true } }, { _id: false });

const ShipmentSchema = new Schema<IShipment>({
  org_id:                { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  ref:                   { type: String, required: true },
  origin_entity_id:      { type: Schema.Types.ObjectId, ref: 'WatchlistEntity', required: true },
  destination_entity_id: { type: Schema.Types.ObjectId, ref: 'WatchlistEntity', required: true },
  route_polyline:        { type: [CoordSchema], default: [] },
  status:                { type: String, enum: ['draft', 'in_transit', 'delivered', 'cancelled'], default: 'draft' },
  eta_at:                { type: Date, default: null },
  value_usd:             { type: Number, required: true, min: 0 },
  active:                { type: Boolean, default: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

ShipmentSchema.index({ org_id: 1, active: 1 });
ShipmentSchema.index({ org_id: 1, status: 1 });
ShipmentSchema.index({ org_id: 1, origin_entity_id: 1 });
ShipmentSchema.index({ org_id: 1, destination_entity_id: 1 });

export const Shipment: Model<IShipment> =
  mongoose.models.Shipment ?? mongoose.model<IShipment>('Shipment', ShipmentSchema);
