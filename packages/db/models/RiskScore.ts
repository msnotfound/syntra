import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IRiskScore extends Document {
  org_id: Types.ObjectId;
  score: number;
  by_region: Record<string, number>;
  by_route: Record<string, number>;
  by_severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  alert_count_7d: number;
  computed_at: Date;
}

const RiskScoreSchema = new Schema<IRiskScore>({
  org_id:         { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  score:          { type: Number, min: 0, max: 100, required: true },
  by_region:      { type: Schema.Types.Mixed, default: {} },
  by_route:       { type: Schema.Types.Mixed, default: {} },
  by_severity: {
    critical: { type: Number, default: 0 },
    high:     { type: Number, default: 0 },
    medium:   { type: Number, default: 0 },
    low:      { type: Number, default: 0 },
    info:     { type: Number, default: 0 },
  },
  alert_count_7d: { type: Number, default: 0 },
  computed_at:    { type: Date, required: true },
}, { timestamps: false });

RiskScoreSchema.index({ org_id: 1, computed_at: -1 });

export const RiskScore: Model<IRiskScore> =
  mongoose.models.RiskScore ?? mongoose.model<IRiskScore>('RiskScore', RiskScoreSchema);
