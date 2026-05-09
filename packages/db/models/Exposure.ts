import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IExposure extends Document {
  org_id: Types.ObjectId;
  entity_id: Types.ObjectId;
  alert_id: Types.ObjectId | null;
  var_value_usd: number;
  var_value_inr: number;
  confidence_interval: number;
  methodology: string;
  computed_at: Date;
}

const ExposureSchema = new Schema<IExposure>({
  org_id:    { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  entity_id: { type: Schema.Types.ObjectId, ref: 'WatchlistEntity', required: true },
  alert_id:  { type: Schema.Types.ObjectId, ref: 'Alert', default: null },
  var_value_usd: { type: Number, required: true },
  var_value_inr: { type: Number, required: true },
  confidence_interval: { type: Number, required: true },
  methodology: { type: String, required: true },
  computed_at: { type: Date, required: true },
}, { timestamps: false });

ExposureSchema.index({ org_id: 1, computed_at: -1 });
ExposureSchema.index({ entity_id: 1, computed_at: -1 });
ExposureSchema.index({ alert_id: 1 });

export const Exposure: Model<IExposure> =
  mongoose.models.Exposure ??
  mongoose.model<IExposure>('Exposure', ExposureSchema);
