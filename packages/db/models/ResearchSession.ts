import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';

export type ResearchSessionStatus = 'planning' | 'researching' | 'drafting' | 'finalized' | 'cancelled';
export type ResearchStepKind = 'sub_question' | 'pull_intel_claims' | 'fetch_external' | 'synthesize' | 'recommend_actions';
export type ResearchStepStatus = 'proposed' | 'accepted' | 'edited' | 'running' | 'done' | 'skipped';

export interface IResearchStepOutput {
  kind: 'text' | 'claim_ids' | 'fetch_result';
  payload: unknown;
}

export interface IResearchPlanStep {
  step_id: string;
  order: number;
  kind: ResearchStepKind;
  title: string;
  description: string | null;
  status: ResearchStepStatus;
  prompt: string | null;
  output: IResearchStepOutput | null;
  evidence_claim_ids: string[];
  created_at: Date;
  updated_at: Date;
}

export interface IResearchSession extends Document {
  org_id: Types.ObjectId;
  user_id: string;
  question: string;
  status: ResearchSessionStatus;
  plan_steps: IResearchPlanStep[];
  final_report_id: Types.ObjectId | null;
  created_at: Date;
  updated_at: Date;
}

const ResearchPlanStepSchema = new Schema<IResearchPlanStep>(
  {
    step_id:           { type: String, required: true, default: () => randomUUID() },
    order:             { type: Number, required: true },
    kind:              { type: String, enum: ['sub_question', 'pull_intel_claims', 'fetch_external', 'synthesize', 'recommend_actions'], required: true },
    title:             { type: String, required: true },
    description:       { type: String, default: null },
    status:            { type: String, enum: ['proposed', 'accepted', 'edited', 'running', 'done', 'skipped'], default: 'proposed' },
    prompt:            { type: String, default: null },
    output:            { type: Schema.Types.Mixed, default: null },
    evidence_claim_ids: [{ type: String }],
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, _id: false },
);

const ResearchSessionSchema = new Schema<IResearchSession>(
  {
    org_id:          { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    user_id:         { type: String, required: true },
    question:        { type: String, required: true },
    status:          { type: String, enum: ['planning', 'researching', 'drafting', 'finalized', 'cancelled'], default: 'planning' },
    plan_steps:      [ResearchPlanStepSchema],
    final_report_id: { type: Schema.Types.ObjectId, ref: 'ResearchReport', default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

ResearchSessionSchema.index({ org_id: 1, created_at: -1 });
ResearchSessionSchema.index({ org_id: 1, status: 1 });

export const ResearchSession: Model<IResearchSession> =
  mongoose.models.ResearchSession ??
  mongoose.model<IResearchSession>('ResearchSession', ResearchSessionSchema);
