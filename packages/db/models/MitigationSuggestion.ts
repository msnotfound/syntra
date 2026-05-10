import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type MitigationSuggestionType =
  | 'alt_route'
  | 'alt_supplier'
  | 'inventory_buffer'
  | 'contract_clause';

export type MitigationStatus = 'proposed' | 'accepted' | 'rejected';

export interface IMitigationSuggestion extends Document {
  org_id: Types.ObjectId;
  alert_id: Types.ObjectId;
  suggestion_type: MitigationSuggestionType;
  narrative: string;
  confidence_pct: number;
  estimated_var_reduction_usd: number | null;
  expected_outcome: Record<string, unknown> | null;
  outcome_actual: Record<string, unknown> | null;
  sources: string[];
  status: MitigationStatus;
  created_at: Date;
}

const MitigationSuggestionSchema = new Schema<IMitigationSuggestion>({
  org_id:    { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  alert_id:  { type: Schema.Types.ObjectId, ref: 'Alert', required: true },
  suggestion_type: {
    type: String,
    enum: ['alt_route', 'alt_supplier', 'inventory_buffer', 'contract_clause'],
    required: true,
  },
  narrative:                  { type: String, required: true },
  confidence_pct:             { type: Number, required: true, min: 0, max: 100 },
  estimated_var_reduction_usd: { type: Number, default: null },
  expected_outcome:           { type: Schema.Types.Mixed, default: null },
  outcome_actual:             { type: Schema.Types.Mixed, default: null },
  sources:                    { type: [String], default: [] },
  status: {
    type: String,
    enum: ['proposed', 'accepted', 'rejected'],
    default: 'proposed',
  },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

MitigationSuggestionSchema.index({ org_id: 1, created_at: -1 });
MitigationSuggestionSchema.index({ alert_id: 1 });
MitigationSuggestionSchema.index({ org_id: 1, status: 1 });

export const MitigationSuggestion: Model<IMitigationSuggestion> =
  mongoose.models.MitigationSuggestion ??
  mongoose.model<IMitigationSuggestion>('MitigationSuggestion', MitigationSuggestionSchema);
