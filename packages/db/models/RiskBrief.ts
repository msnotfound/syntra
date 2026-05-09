import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IRiskBriefContent {
  executive_summary: string;
  situation_overview: string;
  operational_impact: string;
  recommended_actions_prose: string;
  severity: string;
  var_exposure_inr: number | null;
  alert_title: string | null;
  entity_name: string | null;
  org_name: string;
  affected_entities: Array<{ name: string; type: string }>;
  generated_at: Date;
}

export interface IRiskBrief extends Document {
  org_id: Types.ObjectId;
  alert_id: Types.ObjectId | null;
  entity_id: Types.ObjectId | null;
  share_token: string;
  share_token_hash: string;
  expires_at: Date;
  created_by: Types.ObjectId;
  view_count: number;
  content: IRiskBriefContent;
  created_at: Date;
}

const RiskBriefSchema = new Schema<IRiskBrief>({
  org_id:    { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  alert_id:  { type: Schema.Types.ObjectId, ref: 'Alert', default: null },
  entity_id: { type: Schema.Types.ObjectId, ref: 'WatchlistEntity', default: null },
  share_token: { type: String, required: true },
  share_token_hash: { type: String, required: true },
  expires_at: { type: Date, required: true },
  created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  view_count: { type: Number, default: 0 },
  content: {
    executive_summary: { type: String, required: true },
    situation_overview: { type: String, required: true },
    operational_impact: { type: String, required: true },
    recommended_actions_prose: { type: String, required: true },
    severity: { type: String, required: true },
    var_exposure_inr: { type: Number, default: null },
    alert_title: { type: String, default: null },
    entity_name: { type: String, default: null },
    org_name: { type: String, required: true },
    affected_entities: [{
      name: { type: String, required: true },
      type: { type: String, required: true },
    }],
    generated_at: { type: Date, required: true },
  },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

RiskBriefSchema.index({ org_id: 1, created_at: -1 });
RiskBriefSchema.index({ share_token_hash: 1 }, { unique: true });
RiskBriefSchema.index({ alert_id: 1 });
RiskBriefSchema.index({ expires_at: 1 });

export const RiskBrief: Model<IRiskBrief> =
  mongoose.models.RiskBrief ??
  mongoose.model<IRiskBrief>('RiskBrief', RiskBriefSchema);
