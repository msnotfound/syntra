import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IVesselPosition extends Document {
  vessel_imo: string;
  vessel_mmsi: string;
  lat: number;
  lng: number;
  heading: number;
  speed_knots: number;
  nav_status: string;
  source: 'marinetraffic' | 'aishub' | 'spire';
  shipment_id: Types.ObjectId | null;
  recorded_at: Date;
}

const VesselPositionSchema = new Schema<IVesselPosition>({
  vessel_imo:   { type: String, required: true },
  vessel_mmsi:  { type: String, required: true },
  lat:          { type: Number, required: true },
  lng:          { type: Number, required: true },
  heading:      { type: Number, required: true },
  speed_knots:  { type: Number, required: true },
  nav_status:   { type: String, required: true },
  source:       { type: String, enum: ['marinetraffic', 'aishub', 'spire'], required: true },
  shipment_id:  { type: Schema.Types.ObjectId, ref: 'Shipment', default: null },
  recorded_at:  { type: Date, required: true, default: () => new Date() },
});

VesselPositionSchema.index({ vessel_imo: 1, recorded_at: -1 });
VesselPositionSchema.index({ shipment_id: 1, recorded_at: -1 });
VesselPositionSchema.index({ recorded_at: 1 }, { expireAfterSeconds: 30 * 86400 });

export const VesselPosition: Model<IVesselPosition> =
  mongoose.models.VesselPosition ??
  mongoose.model<IVesselPosition>('VesselPosition', VesselPositionSchema);
