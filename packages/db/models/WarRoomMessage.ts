import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type WarRoomMsgType = 'chat' | 'poll' | 'system';

export interface IPollVote {
  user_id: Types.ObjectId;
  vote: 'yes' | 'no' | 'abstain';
}

export interface IPoll {
  question: string;
  votes: IPollVote[];
}

export interface IWarRoomMessage extends Document {
  war_room_id: Types.ObjectId;
  user_id: Types.ObjectId;
  body: string;
  attachments: string[];
  msg_type: WarRoomMsgType;
  poll: IPoll | null;
  created_at: Date;
}

const WarRoomMessageSchema = new Schema<IWarRoomMessage>({
  war_room_id: { type: Schema.Types.ObjectId, ref: 'WarRoom', required: true },
  user_id:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  body:        { type: String, required: true, maxlength: 10000 },
  attachments: { type: [String], default: [] },
  msg_type:    { type: String, enum: ['chat', 'poll', 'system'], default: 'chat' },
  poll: {
    type: new Schema({
      question: { type: String, required: true },
      votes: [{
        user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        vote:    { type: String, enum: ['yes', 'no', 'abstain'], required: true },
      }],
    }, { _id: false }),
    default: null,
  },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

WarRoomMessageSchema.index({ war_room_id: 1, created_at: 1 });

export const WarRoomMessage: Model<IWarRoomMessage> =
  mongoose.models.WarRoomMessage ??
  mongoose.model<IWarRoomMessage>('WarRoomMessage', WarRoomMessageSchema);
