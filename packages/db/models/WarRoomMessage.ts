import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IWarRoomMessage extends Document {
  war_room_id: Types.ObjectId;
  user_id: Types.ObjectId;
  body: string;
  attachments: string[];
  created_at: Date;
}

const WarRoomMessageSchema = new Schema<IWarRoomMessage>({
  war_room_id: { type: Schema.Types.ObjectId, ref: 'WarRoom', required: true },
  user_id:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  body:        { type: String, required: true, maxlength: 10000 },
  attachments: { type: [String], default: [] },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

// Append-only — no update index needed, just fast reads per war room
WarRoomMessageSchema.index({ war_room_id: 1, created_at: 1 });

export const WarRoomMessage: Model<IWarRoomMessage> =
  mongoose.models.WarRoomMessage ?? mongoose.model<IWarRoomMessage>('WarRoomMessage', WarRoomMessageSchema);
