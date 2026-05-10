import mongoose, { Schema, Document, Model } from 'mongoose';
import type { ForecastIndicatorType } from './Forecast.js';

export interface IForecastPrior extends Document {
  indicator_type: ForecastIndicatorType;
  base_rate: number;
  sample_count: number;
  brier_score_avg: number | null;
  updated_at: Date;
}

const ForecastPriorSchema = new Schema<IForecastPrior>(
  {
    indicator_type: {
      type: String,
      enum: ['port-congestion','sanctions-likelihood','shipping-delay','currency-shock','commodity-price','geopolitical-event'],
      required: true,
    },
    base_rate:       { type: Number, required: true, min: 0, max: 1 },
    sample_count:    { type: Number, required: true, min: 0, default: 0 },
    brier_score_avg: { type: Number, default: null },
    updated_at:      { type: Date, required: true },
  },
  { timestamps: false },
);

export const ForecastPrior: Model<IForecastPrior> =
  mongoose.models.ForecastPrior ?? mongoose.model<IForecastPrior>('ForecastPrior', ForecastPriorSchema);
