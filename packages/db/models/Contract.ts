import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type ContractType = 'supply' | 'service' | 'distribution' | 'nda' | 'other';
export type ExtractedCounterpartyRole = 'buyer' | 'seller' | 'guarantor' | 'agent';
export type ExtractedObligationStatus = 'pending' | 'fulfilled' | 'breached' | 'unknown';
export type ExtractedKeyDateType = 'effective' | 'expiry' | 'renewal' | 'milestone';

export interface IExtractedCounterparty {
  name: string;
  role: ExtractedCounterpartyRole;
  entity_id: Types.ObjectId | null;
}

export interface IExtractedObligation {
  party: string;
  description: string;
  due_date: Date | null;
  status: ExtractedObligationStatus;
}

export interface IExtractedKeyDate {
  label: string;
  date: Date;
  type: ExtractedKeyDateType;
}

export interface IExtractedValueClause {
  description: string;
  amount_usd: number | null;
  currency: string;
  trigger: string | null;
}

export interface IContractExtracted {
  counterparties: IExtractedCounterparty[];
  obligations: IExtractedObligation[];
  key_dates: IExtractedKeyDate[];
  value_clauses: IExtractedValueClause[];
  force_majeure: { covered: boolean; excerpt: string | null };
  exclusivity: { exclusive: boolean; scope: string | null; geographies: string[] };
}

export interface IContract extends Document {
  org_id: Types.ObjectId;
  counterparty_id: Types.ObjectId;
  ref: string;
  type: ContractType;
  value_usd: number;
  expires_at: Date | null;
  terms_summary: string;
  force_majeure_clauses: string[];
  source_doc_url: string | null;
  source_doc_hash: string | null;
  extracted: IContractExtracted;
  extraction_run_id: string | null;
  extraction_confidence_pct: number;
  extracted_at: Date | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

const ExtractedCounterpartySchema = new Schema<IExtractedCounterparty>({
  name:      { type: String, required: true },
  role:      { type: String, enum: ['buyer', 'seller', 'guarantor', 'agent'], required: true },
  entity_id: { type: Schema.Types.ObjectId, ref: 'WatchlistEntity', default: null },
}, { _id: false });

const ExtractedObligationSchema = new Schema<IExtractedObligation>({
  party:       { type: String, required: true },
  description: { type: String, required: true },
  due_date:    { type: Date, default: null },
  status:      { type: String, enum: ['pending', 'fulfilled', 'breached', 'unknown'], default: 'unknown' },
}, { _id: false });

const ExtractedKeyDateSchema = new Schema<IExtractedKeyDate>({
  label: { type: String, required: true },
  date:  { type: Date, required: true },
  type:  { type: String, enum: ['effective', 'expiry', 'renewal', 'milestone'], required: true },
}, { _id: false });

const ExtractedValueClauseSchema = new Schema<IExtractedValueClause>({
  description: { type: String, required: true },
  amount_usd:  { type: Number, default: null },
  currency:    { type: String, default: 'USD' },
  trigger:     { type: String, default: null },
}, { _id: false });

const ContractSchema = new Schema<IContract>({
  org_id:                { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  counterparty_id:       { type: Schema.Types.ObjectId, ref: 'Counterparty', required: true },
  ref:                   { type: String, required: true },
  type:                  { type: String, enum: ['supply', 'service', 'distribution', 'nda', 'other'], required: true },
  value_usd:             { type: Number, required: true, min: 0 },
  expires_at:            { type: Date, default: null },
  terms_summary:         { type: String, default: '' },
  force_majeure_clauses: { type: [String], default: [] },
  source_doc_url:        { type: String, default: null },
  source_doc_hash:       { type: String, default: null },
  extracted: {
    counterparties: { type: [ExtractedCounterpartySchema], default: [] },
    obligations:    { type: [ExtractedObligationSchema], default: [] },
    key_dates:      { type: [ExtractedKeyDateSchema], default: [] },
    value_clauses:  { type: [ExtractedValueClauseSchema], default: [] },
    force_majeure: {
      covered: { type: Boolean, default: false },
      excerpt: { type: String, default: null },
    },
    exclusivity: {
      exclusive:   { type: Boolean, default: false },
      scope:       { type: String, default: null },
      geographies: { type: [String], default: [] },
    },
  },
  extraction_run_id:     { type: String, default: null },
  extraction_confidence_pct: { type: Number, min: 0, max: 100, default: 0 },
  extracted_at:          { type: Date, default: null },
  active:                { type: Boolean, default: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

ContractSchema.index({ org_id: 1, active: 1 });
ContractSchema.index({ org_id: 1, counterparty_id: 1 });
ContractSchema.index({ org_id: 1, type: 1 });
ContractSchema.index({ org_id: 1, source_doc_hash: 1 }, { sparse: true });

export const Contract: Model<IContract> =
  mongoose.models.Contract ?? mongoose.model<IContract>('Contract', ContractSchema);
