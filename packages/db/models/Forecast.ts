import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type ForecastIndicatorType =
  | 'port-congestion'
  | 'sanctions-likelihood'
  | 'shipping-delay'
  | 'currency-shock'
  | 'commodity-price'
  | 'geopolitical-event';

export type ForecastOutcome = 'occurred' | 'did_not_occur';

export interface IForecast extends Document {
  org_id: Types.ObjectId;
  indicator_id: Types.ObjectId;          // ref: LeadingIndicator
  indicator_type: ForecastIndicatorType;
  target_entity_id: Types.ObjectId | null; // ref: WatchlistEntity; null = org-wide
  probability_pct: number;               // 0–100
  time_horizon_days: number;
  supporting_claims: Types.ObjectId[];   // ref: IntelClaim
  narrative: string;                     // LLM-generated rationale
  recommended_action: string;
  computed_at: Date;
  expires_at: Date;
  methodology: string;
  // Accuracy tracking (filled by forecast-resolve worker)
  actual_outcome: ForecastOutcome | null;
  // Brier score: (probability_pct/100 - outcome)^2 where outcome 0 or 1
  brier_score: number | null;
}

const ForecastSchema = new Schema<IForecast>(
  {
    org_id:        { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    indicator_id:  { type: Schema.Types.ObjectId, ref: 'LeadingIndicator', required: true },
    indicator_type: {
      type: String,
      enum: ['port-congestion','sanctions-likelihood','shipping-delay','currency-shock','commodity-price','geopolitical-event'],
      required: true,
    },
    target_entity_id:  { type: Schema.Types.ObjectId, ref: 'WatchlistEntity', default: null },
    probability_pct:   { type: Number, required: true, min: 0, max: 100 },
    time_horizon_days: { type: Number, required: true },
    supporting_claims: [{ type: Schema.Types.ObjectId, ref: 'IntelClaim' }],
    narrative:         { type: String, required: true },
    recommended_action: { type: String, required: true },
    computed_at:       { type: Date, required: true },
    expires_at:        { type: Date, required: true },
    methodology:       { type: String, required: true },
    actual_outcome:    { type: String, enum: ['occurred','did_not_occur'], default: null },
    brier_score:       { type: Number, default: null },
  },
  { timestamps: false },
);

ForecastSchema.index({ org_id: 1, expires_at: 1 });
ForecastSchema.index({ org_id: 1, indicator_type: 1, computed_at: -1 });
ForecastSchema.index({ org_id: 1, actual_outcome: 1 });
// Idempotency guard: one forecast per org+indicator per expiry window
ForecastSchema.index({ org_id: 1, indicator_id: 1, expires_at: 1 }, { unique: true });

export const Forecast: Model<IForecast> =
  mongoose.models.Forecast ?? mongoose.model<IForecast>('Forecast', ForecastSchema);
