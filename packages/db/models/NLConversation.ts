import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface INLConversationTurn {
  role: 'user' | 'assistant';
  text: string;
  entity_ids: string[];
  created_at: Date;
}

export interface INLConversation extends Document {
  org_id: Types.ObjectId;
  user_id: string;
  conversation_id: string;
  turns: INLConversationTurn[];
  created_at: Date;
  updated_at: Date;
}

const NLConversationTurnSchema = new Schema<INLConversationTurn>({
  role:       { type: String, enum: ['user', 'assistant'], required: true },
  text:       { type: String, required: true },
  entity_ids: { type: [String], default: [] },
  created_at: { type: Date, default: Date.now },
}, { _id: false });

const NLConversationSchema = new Schema<INLConversation>({
  org_id:          { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  user_id:         { type: String, required: true },
  conversation_id: { type: String, required: true },
  turns:           { type: [NLConversationTurnSchema], default: [] },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

NLConversationSchema.index({ org_id: 1, user_id: 1, conversation_id: 1 }, { unique: true });
NLConversationSchema.index({ updated_at: -1 });

export const NLConversation: Model<INLConversation> =
  mongoose.models.NLConversation ??
  mongoose.model<INLConversation>('NLConversation', NLConversationSchema);
