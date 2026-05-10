import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type CoverageType = 'marine' | 'cargo' | 'trade_credit' | 'political_risk' | 'other';

export interface IPolicySubLimit {
  peril_kind?: string;
  counterparty_id?: string;
  limit_usd: number;
}

export interface IPolicyExclusion {
  peril_kind: string;
  reason: string;
}

export interface IPolicyClaim {
  claim_id: string;
  paid_usd: number;
  denied: boolean;
  date: Date;
}

export interface IInsurancePolicy extends Document {
  org_id: Types.ObjectId;
  policy_id: string;        // user-visible ID, unique within org (e.g. "POL-2024-001")
  insurer_name: string;
  coverage_type: CoverageType;
  max_payout_usd: number;
  aggregate_limit_usd: number;
  sub_limits: IPolicySubLimit[];
  exclusions: IPolicyExclusion[];
  claims_history: IPolicyClaim[];
  deductible_usd: number;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

const PolicySubLimitSchema = new Schema<IPolicySubLimit>({
  peril_kind:     { type: String, default: undefined },
  counterparty_id: { type: String, default: undefined },
  limit_usd:      { type: Number, required: true, min: 0 },
}, { _id: false });

const PolicyExclusionSchema = new Schema<IPolicyExclusion>({
  peril_kind: { type: String, required: true },
  reason:     { type: String, required: true },
}, { _id: false });

const PolicyClaimSchema = new Schema<IPolicyClaim>({
  claim_id: { type: String, required: true },
  paid_usd: { type: Number, required: true, min: 0 },
  denied:   { type: Boolean, required: true, default: false },
  date:     { type: Date, required: true },
}, { _id: false });

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
  aggregate_limit_usd: {
    type: Number,
    required: true,
    min: 0,
    default: function aggregateLimitDefault(this: IInsurancePolicy) {
      return this.max_payout_usd;
    },
  },
  sub_limits:     { type: [PolicySubLimitSchema], default: [] },
  exclusions:     { type: [PolicyExclusionSchema], default: [] },
  claims_history: { type: [PolicyClaimSchema], default: [] },
  deductible_usd: { type: Number, required: true, min: 0, default: 0 },
  expires_at:     { type: Date, required: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

InsurancePolicySchema.index({ org_id: 1, policy_id: 1 }, { unique: true });
InsurancePolicySchema.index({ org_id: 1, expires_at: 1 });

export const InsurancePolicy: Model<IInsurancePolicy> =
  mongoose.models.InsurancePolicy ??
  mongoose.model<IInsurancePolicy>('InsurancePolicy', InsurancePolicySchema);
