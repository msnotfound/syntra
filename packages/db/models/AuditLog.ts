import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IAuditLog extends Document {
  org_id: Types.ObjectId;
  user_id: Types.ObjectId | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  created_at: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  org_id:  { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  user_id: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  action:  { type: String, required: true },
  resource_type: { type: String, required: true },
  resource_id:   { type: String, default: null },
  metadata: { type: Schema.Types.Mixed, default: {} },
  ip: { type: String, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

AuditLogSchema.index({ org_id: 1, created_at: -1 });
AuditLogSchema.index({ resource_type: 1, resource_id: 1 });

export const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog ?? mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
