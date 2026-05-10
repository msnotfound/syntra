import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IAssistantThreadTurn {
  role: 'user' | 'assistant';
  text: string;
  cited_claim_ids: string[];
  created_at: Date;
}

export interface IAssistantThread extends Document {
  org_id: Types.ObjectId;
  user_id: string;
  conversation_id: string;
  turns: IAssistantThreadTurn[];
  context_page: string | null;
  context_entity_ids: string[];
  created_at: Date;
  updated_at: Date;
}

const AssistantThreadTurnSchema = new Schema<IAssistantThreadTurn>(
  {
    role:            { type: String, enum: ['user', 'assistant'], required: true },
    text:            { type: String, required: true },
    cited_claim_ids: { type: [String], default: [] },
    created_at:      { type: Date, default: Date.now },
  },
  { _id: false },
);

const AssistantThreadSchema = new Schema<IAssistantThread>(
  {
    org_id:             { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    user_id:            { type: String, required: true },
    conversation_id:    { type: String, required: true },
    turns:              { type: [AssistantThreadTurnSchema], default: [] },
    context_page:       { type: String, default: null },
    context_entity_ids: { type: [String], default: [] },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

AssistantThreadSchema.index({ org_id: 1, conversation_id: 1 }, { unique: true });
AssistantThreadSchema.index({ org_id: 1, user_id: 1 });
AssistantThreadSchema.index({ updated_at: -1 });

export const AssistantThread: Model<IAssistantThread> =
  mongoose.models.AssistantThread ??
  mongoose.model<IAssistantThread>('AssistantThread', AssistantThreadSchema);
