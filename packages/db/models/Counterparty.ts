import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type CounterpartyRole = 'supplier' | 'customer' | 'broker' | 'logistics';

export interface ICounterparty extends Document {
  org_id: Types.ObjectId;
  entity_id: Types.ObjectId;
  role: CounterpartyRole;
  source: 'manual' | 'imported' | 'extracted_contract';
  risk_score: number;
  relationship_value_usd: number;
  contract_id: Types.ObjectId | null;
  parent_entity_id: Types.ObjectId | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

const CounterpartySchema = new Schema<ICounterparty>({
  org_id:                { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  entity_id:             { type: Schema.Types.ObjectId, ref: 'WatchlistEntity', required: true },
  role:                  { type: String, enum: ['supplier', 'customer', 'broker', 'logistics'], required: true },
  source:                { type: String, enum: ['manual', 'imported', 'extracted_contract'], default: 'manual' },
  risk_score:            { type: Number, required: true, min: 0, max: 100 },
  relationship_value_usd: { type: Number, required: true, min: 0 },
  contract_id:           { type: Schema.Types.ObjectId, ref: 'Contract', default: null },
  parent_entity_id:      { type: Schema.Types.ObjectId, ref: 'WatchlistEntity', default: null },
  active:                { type: Boolean, default: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

CounterpartySchema.index({ org_id: 1, active: 1 });
CounterpartySchema.index({ org_id: 1, role: 1 });
CounterpartySchema.index({ org_id: 1, entity_id: 1 });
CounterpartySchema.index({ org_id: 1, parent_entity_id: 1 });
CounterpartySchema.index({ org_id: 1, risk_score: -1 });

export const Counterparty: Model<ICounterparty> =
  mongoose.models.Counterparty ?? mongoose.model<ICounterparty>('Counterparty', CounterpartySchema);
