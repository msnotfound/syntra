import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type ContractType = 'supply' | 'service' | 'distribution' | 'nda' | 'other';

export interface IContract extends Document {
  org_id: Types.ObjectId;
  counterparty_id: Types.ObjectId;
  ref: string;
  type: ContractType;
  value_usd: number;
  expires_at: Date | null;
  terms_summary: string;
  force_majeure_clauses: string[];
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

const ContractSchema = new Schema<IContract>({
  org_id:                { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  counterparty_id:       { type: Schema.Types.ObjectId, ref: 'Counterparty', required: true },
  ref:                   { type: String, required: true },
  type:                  { type: String, enum: ['supply', 'service', 'distribution', 'nda', 'other'], required: true },
  value_usd:             { type: Number, required: true, min: 0 },
  expires_at:            { type: Date, default: null },
  terms_summary:         { type: String, default: '' },
  force_majeure_clauses: { type: [String], default: [] },
  active:                { type: Boolean, default: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

ContractSchema.index({ org_id: 1, active: 1 });
ContractSchema.index({ org_id: 1, counterparty_id: 1 });
ContractSchema.index({ org_id: 1, type: 1 });

export const Contract: Model<IContract> =
  mongoose.models.Contract ?? mongoose.model<IContract>('Contract', ContractSchema);
