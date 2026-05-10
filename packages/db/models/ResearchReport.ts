import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IReportSection {
  heading: string;
  markdown: string;
  cited_claim_ids: string[];
}

export interface IClaimGraphNode {
  id: string;
  label: string;
  kind: 'fact' | 'inference' | 'forecast';
}

export interface IClaimGraphEdge {
  from: string;
  to: string;
  label: string;
}

export interface IRecommendedAction {
  text: string;
  rationale: string;
  cited_claim_ids: string[];
}

export interface IResearchReport extends Document {
  org_id: Types.ObjectId;
  research_session_id: Types.ObjectId;
  sections: IReportSection[];
  claim_graph: {
    nodes: IClaimGraphNode[];
    edges: IClaimGraphEdge[];
  };
  exec_summary: string;
  recommended_actions: IRecommendedAction[];
  risk_brief_id: Types.ObjectId | null;
  created_at: Date;
}

const ReportSectionSchema = new Schema<IReportSection>(
  {
    heading:         { type: String, required: true },
    markdown:        { type: String, required: true },
    cited_claim_ids: [{ type: String }],
  },
  { _id: false },
);

const ResearchReportSchema = new Schema<IResearchReport>(
  {
    org_id:              { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    research_session_id: { type: Schema.Types.ObjectId, ref: 'ResearchSession', required: true },
    sections:            [ReportSectionSchema],
    claim_graph: {
      nodes: [{ id: String, label: String, kind: String, _id: false }],
      edges: [{ from: String, to: String, label: String, _id: false }],
    },
    exec_summary:        { type: String, required: true },
    recommended_actions: [{
      text:            { type: String, required: true },
      rationale:       { type: String, required: true },
      cited_claim_ids: [{ type: String }],
      _id: false,
    }],
    risk_brief_id: { type: Schema.Types.ObjectId, ref: 'RiskBrief', default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
);

ResearchReportSchema.index({ org_id: 1, created_at: -1 });
ResearchReportSchema.index({ research_session_id: 1 }, { unique: true });

export const ResearchReport: Model<IResearchReport> =
  mongoose.models.ResearchReport ??
  mongoose.model<IResearchReport>('ResearchReport', ResearchReportSchema);
