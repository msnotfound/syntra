import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type ClaimType = 'fact' | 'inference' | 'forecast';

export interface IIntelClaim extends Document {
  source_id: Types.ObjectId;
  claim_text: string;
  evidence_url: string | null;
  asserted_at: Date;
  parent_claim_ids: Types.ObjectId[];
  claim_type: ClaimType;
  alert_id: Types.ObjectId | null;
  created_at: Date;
}

const IntelClaimSchema = new Schema<IIntelClaim>(
  {
    source_id:       { type: Schema.Types.ObjectId, ref: 'SourceReliability', required: true },
    claim_text:      { type: String, required: true },
    evidence_url:    { type: String, default: null },
    asserted_at:     { type: Date, required: true },
    parent_claim_ids: [{ type: Schema.Types.ObjectId, ref: 'IntelClaim' }],
    claim_type:      { type: String, enum: ['fact', 'inference', 'forecast'], required: true },
    alert_id:        { type: Schema.Types.ObjectId, ref: 'Alert', default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  },
);

// Append-only: no update/delete indexes needed; optimise for provenance traversal.
IntelClaimSchema.index({ alert_id: 1, created_at: -1 });
IntelClaimSchema.index({ source_id: 1 });
IntelClaimSchema.index({ parent_claim_ids: 1 });

export const IntelClaim: Model<IIntelClaim> =
  mongoose.models.IntelClaim ??
  mongoose.model<IIntelClaim>('IntelClaim', IntelClaimSchema);
