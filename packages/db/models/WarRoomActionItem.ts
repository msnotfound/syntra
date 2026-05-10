import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type ActionItemStatus = 'open' | 'in_progress' | 'done';

export interface IWarRoomActionItem extends Document {
  war_room_id: Types.ObjectId;
  org_id: Types.ObjectId;
  title: string;
  assignee_user_id: Types.ObjectId | null;
  due_at: Date | null;
  status: ActionItemStatus;
  created_by: Types.ObjectId;
  created_at: Date;
}

const WarRoomActionItemSchema = new Schema<IWarRoomActionItem>({
  war_room_id:      { type: Schema.Types.ObjectId, ref: 'WarRoom', required: true },
  org_id:           { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  title:            { type: String, required: true, maxlength: 500 },
  assignee_user_id: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  due_at:           { type: Date, default: null },
  status:           { type: String, enum: ['open', 'in_progress', 'done'], default: 'open' },
  created_by:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

WarRoomActionItemSchema.index({ war_room_id: 1, status: 1 });
WarRoomActionItemSchema.index({ org_id: 1, created_at: -1 });

export const WarRoomActionItem: Model<IWarRoomActionItem> =
  mongoose.models.WarRoomActionItem ??
  mongoose.model<IWarRoomActionItem>('WarRoomActionItem', WarRoomActionItemSchema);
