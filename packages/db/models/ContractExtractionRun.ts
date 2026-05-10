import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type ContractExtractionRunStatus = 'queued' | 'running' | 'completed' | 'duplicate' | 'error';

export interface IContractExtractionRun extends Document {
  org_id: Types.ObjectId;
  contract_id: Types.ObjectId | null;
  doc_url: string;
  input_doc_hash: string | null;
  llm_tokens_used: number;
  status: ContractExtractionRunStatus;
  success: boolean;
  error: string | null;
  latency_ms: number;
  started_at: Date;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const ContractExtractionRunSchema = new Schema<IContractExtractionRun>({
  org_id:          { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  contract_id:     { type: Schema.Types.ObjectId, ref: 'Contract', default: null },
  doc_url:         { type: String, required: true },
  input_doc_hash:  { type: String, default: null },
  llm_tokens_used: { type: Number, min: 0, default: 0 },
  status:          { type: String, enum: ['queued', 'running', 'completed', 'duplicate', 'error'], default: 'queued' },
  success:         { type: Boolean, default: false },
  error:           { type: String, default: null },
  latency_ms:      { type: Number, min: 0, default: 0 },
  started_at:      { type: Date, default: () => new Date() },
  completed_at:    { type: Date, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

ContractExtractionRunSchema.index({ org_id: 1, created_at: -1 });
ContractExtractionRunSchema.index({ org_id: 1, input_doc_hash: 1 });
ContractExtractionRunSchema.index({ status: 1, created_at: -1 });

export const ContractExtractionRun: Model<IContractExtractionRun> =
  mongoose.models.ContractExtractionRun ??
  mongoose.model<IContractExtractionRun>('ContractExtractionRun', ContractExtractionRunSchema);
