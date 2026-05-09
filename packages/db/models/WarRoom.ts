import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IWarRoom extends Document {
  org_id: Types.ObjectId;
  alert_id: Types.ObjectId | null;
  name: string;
  status: 'open' | 'closed';
  created_by: Types.ObjectId;
  participants: Types.ObjectId[];
  created_at: Date;
}

const WarRoomSchema = new Schema<IWarRoom>({
  org_id:      { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  alert_id:    { type: Schema.Types.ObjectId, ref: 'Alert', default: null },
  name:        { type: String, required: true, maxlength: 200 },
  status:      { type: String, enum: ['open', 'closed'], default: 'open' },
  created_by:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

WarRoomSchema.index({ org_id: 1, created_at: -1 });
WarRoomSchema.index({ org_id: 1, status: 1 });
WarRoomSchema.index({ alert_id: 1 });

export const WarRoom: Model<IWarRoom> =
  mongoose.models.WarRoom ?? mongoose.model<IWarRoom>('WarRoom', WarRoomSchema);
