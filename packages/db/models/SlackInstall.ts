import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ISlackInstall extends Document {
  org_id: Types.ObjectId;
  workspace_id: string;
  team_name: string;
  bot_token_encrypted: string;
  scope: string;
  installed_at: Date;
}

const SlackInstallSchema = new Schema<ISlackInstall>({
  org_id:               { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  workspace_id:         { type: String, required: true },
  team_name:            { type: String, default: '' },
  bot_token_encrypted:  { type: String, required: true },
  scope:                { type: String, default: '' },
  installed_at:         { type: Date, default: Date.now },
}, { timestamps: false });

SlackInstallSchema.index({ org_id: 1 }, { unique: true });
SlackInstallSchema.index({ workspace_id: 1 });

export const SlackInstall: Model<ISlackInstall> =
  mongoose.models.SlackInstall ?? mongoose.model<ISlackInstall>('SlackInstall', SlackInstallSchema);
