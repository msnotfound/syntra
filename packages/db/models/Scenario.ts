import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type HypothesisEventType = 'physical_risk' | 'sanctions_match' | 'compliance';
export type HypothesisEventSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface HypothesisEvent {
  type: HypothesisEventType;
  geo: string;
  severity: HypothesisEventSeverity;
}

export interface IScenario extends Document {
  org_id: Types.ObjectId;
  name: string;
  description: string;
  hypothesis_events: HypothesisEvent[];
  affected_entity_ids: Types.ObjectId[];
  computed_var_total_usd: number | null;
  computed_at: Date | null;
  created_by: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const HypothesisEventSchema = new Schema<HypothesisEvent>({
  type:     { type: String, enum: ['physical_risk', 'sanctions_match', 'compliance'], required: true },
  geo:      { type: String, required: true },
  severity: { type: String, enum: ['critical', 'high', 'medium', 'low', 'info'], required: true },
}, { _id: false });

const ScenarioSchema = new Schema<IScenario>({
  org_id:                 { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  name:                   { type: String, required: true, maxlength: 200 },
  description:            { type: String, default: '' },
  hypothesis_events:      { type: [HypothesisEventSchema], default: [] },
  affected_entity_ids:    [{ type: Schema.Types.ObjectId, ref: 'WatchlistEntity' }],
  computed_var_total_usd: { type: Number, default: null },
  computed_at:            { type: Date, default: null },
  created_by:             { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

ScenarioSchema.index({ org_id: 1, created_at: -1 });
ScenarioSchema.index({ org_id: 1, computed_at: -1 });

export const Scenario: Model<IScenario> =
  mongoose.models.Scenario ??
  mongoose.model<IScenario>('Scenario', ScenarioSchema);
