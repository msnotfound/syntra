import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type CoverageType = 'marine' | 'cargo' | 'trade_credit' | 'political_risk' | 'other';

export interface IInsurancePolicy extends Document {
  org_id: Types.ObjectId;
  policy_id: string;        // user-visible ID, unique within org (e.g. "POL-2024-001")
  insurer_name: string;
  coverage_type: CoverageType;
  max_payout_usd: number;
  deductible_usd: number;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

const InsurancePolicySchema = new Schema<IInsurancePolicy>({
  org_id:       { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  policy_id:    { type: String, required: true },
  insurer_name: { type: String, required: true },
  coverage_type: {
    type: String,
    enum: ['marine', 'cargo', 'trade_credit', 'political_risk', 'other'],
    required: true,
  },
  max_payout_usd: { type: Number, required: true, min: 0 },
  deductible_usd: { type: Number, required: true, min: 0, default: 0 },
  expires_at:     { type: Date, required: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

InsurancePolicySchema.index({ org_id: 1, policy_id: 1 }, { unique: true });
InsurancePolicySchema.index({ org_id: 1, expires_at: 1 });

export const InsurancePolicy: Model<IInsurancePolicy> =
  mongoose.models.InsurancePolicy ??
  mongoose.model<IInsurancePolicy>('InsurancePolicy', InsurancePolicySchema);
