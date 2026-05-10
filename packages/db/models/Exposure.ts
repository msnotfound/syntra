import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IExposureSimulation {
  var_at_75: number;
  var_at_95: number;
  var_at_99: number;
  iterations: number;
  distribution: {
    min: number;
    mode: number;
    max: number;
  };
  methodology: string;
  computed_at: Date;
}

export interface IExposure extends Document {
  org_id: Types.ObjectId;
  entity_id: Types.ObjectId;
  alert_id: Types.ObjectId | null;
  var_value_usd: number;
  var_value_inr: number;
  confidence_interval: number;
  methodology: string;
  computed_at: Date;
  // M30: insurance fields
  insurance_coverage_pct: number;       // 0–100, pct of VaR covered by policy
  policy_id: string | null;             // reference to InsurancePolicy.policy_id
  coverage_gap_usd: number;             // max(0, var_value_usd * (1 - insurance_coverage_pct/100))
  exposure_delta_usd: number | null;    // change vs prior computed value (positive = worsened)
  // M21 depth pass: optional Monte Carlo percentile bands.
  simulation: IExposureSimulation | null;
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
  // M30: insurance fields (additive, all have defaults so existing docs keep working)
  insurance_coverage_pct: { type: Number, default: 0, min: 0, max: 100 },
  policy_id: { type: String, default: null },
  coverage_gap_usd: { type: Number, default: 0 },
  exposure_delta_usd: { type: Number, default: null },
  simulation: { type: Schema.Types.Mixed, default: null },
}, { timestamps: false });

ExposureSchema.index({ org_id: 1, computed_at: -1 });
ExposureSchema.index({ entity_id: 1, computed_at: -1 });
ExposureSchema.index({ alert_id: 1 });

export const Exposure: Model<IExposure> =
  mongoose.models.Exposure ??
  mongoose.model<IExposure>('Exposure', ExposureSchema);
