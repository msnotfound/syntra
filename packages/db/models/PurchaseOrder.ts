import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type POStatus = 'draft' | 'approved' | 'shipped' | 'received' | 'cancelled';

export interface IPOItem {
  description: string;
  qty: number;
  unit_price_usd: number;
}

export interface IPurchaseOrder extends Document {
  org_id: Types.ObjectId;
  po_number: string;
  supplier_entity_id: Types.ObjectId;
  items: IPOItem[];
  total_usd: number;
  status: POStatus;
  due_at: Date | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

const POItemSchema = new Schema<IPOItem>({
  description:   { type: String, required: true },
  qty:           { type: Number, required: true, min: 0 },
  unit_price_usd: { type: Number, required: true, min: 0 },
}, { _id: false });

const PurchaseOrderSchema = new Schema<IPurchaseOrder>({
  org_id:             { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  po_number:          { type: String, required: true },
  supplier_entity_id: { type: Schema.Types.ObjectId, ref: 'WatchlistEntity', required: true },
  items:              { type: [POItemSchema], default: [] },
  total_usd:          { type: Number, required: true, min: 0 },
  status:             { type: String, enum: ['draft', 'approved', 'shipped', 'received', 'cancelled'], default: 'draft' },
  due_at:             { type: Date, default: null },
  active:             { type: Boolean, default: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

PurchaseOrderSchema.index({ org_id: 1, active: 1 });
PurchaseOrderSchema.index({ org_id: 1, status: 1 });
PurchaseOrderSchema.index({ org_id: 1, supplier_entity_id: 1 });

export const PurchaseOrder: Model<IPurchaseOrder> =
  mongoose.models.PurchaseOrder ?? mongoose.model<IPurchaseOrder>('PurchaseOrder', PurchaseOrderSchema);
