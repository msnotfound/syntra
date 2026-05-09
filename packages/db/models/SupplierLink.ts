import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ISupplierLink extends Document {
  org_id: Types.ObjectId;
  parent_entity_id: Types.ObjectId;
  child_entity_id: Types.ObjectId;
  tier_offset: 1 | 2 | 3;
  source: 'manual' | 'extracted' | 'imported';
  created_at: Date;
  updated_at: Date;
}

const SupplierLinkSchema = new Schema<ISupplierLink>({
  org_id:            { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  parent_entity_id:  { type: Schema.Types.ObjectId, ref: 'WatchlistEntity', required: true },
  child_entity_id:   { type: Schema.Types.ObjectId, ref: 'WatchlistEntity', required: true },
  tier_offset:       { type: Number, enum: [1, 2, 3], required: true },
  source:            { type: String, enum: ['manual', 'extracted', 'imported'], required: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

SupplierLinkSchema.index({ org_id: 1, parent_entity_id: 1 });
SupplierLinkSchema.index({ org_id: 1, child_entity_id: 1 });
SupplierLinkSchema.index({ org_id: 1, tier_offset: 1 });

export const SupplierLink: Model<ISupplierLink> =
  mongoose.models.SupplierLink ??
  mongoose.model<ISupplierLink>('SupplierLink', SupplierLinkSchema);
