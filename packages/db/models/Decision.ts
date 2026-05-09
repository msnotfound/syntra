import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type DecisionType =
  | 'acknowledged'
  | 'assigned'
  | 'closed'
  | 'escalated'
  | 'mitigation_chosen';

export interface IDecision extends Document {
  org_id: Types.ObjectId;
  alert_id: Types.ObjectId;
  user_id: Types.ObjectId;
  decision_type: DecisionType;
  decision_text: string;
  justification: string;
  made_at: Date;
}

const DecisionSchema = new Schema<IDecision>(
  {
    org_id: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    alert_id: { type: Schema.Types.ObjectId, ref: 'Alert', required: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    decision_type: {
      type: String,
      enum: ['acknowledged', 'assigned', 'closed', 'escalated', 'mitigation_chosen'],
      required: true,
    },
    decision_text: { type: String, required: true },
    justification: { type: String, default: '' },
    made_at: { type: Date, required: true },
  },
  {
    // No updatedAt — append-only; documents are never modified after creation.
    timestamps: false,
  },
);

// Enforce append-only: block any update/replace operations at the middleware level.
DecisionSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne'] as never[], function () {
  throw new Error('Decision records are append-only and cannot be modified.');
});

DecisionSchema.index({ org_id: 1, made_at: -1 });
DecisionSchema.index({ org_id: 1, alert_id: 1, made_at: -1 });
DecisionSchema.index({ org_id: 1, user_id: 1, made_at: -1 });
DecisionSchema.index({ org_id: 1, decision_type: 1, made_at: -1 });

export const Decision: Model<IDecision> =
  mongoose.models.Decision ?? mongoose.model<IDecision>('Decision', DecisionSchema);
