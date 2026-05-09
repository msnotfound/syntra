import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ITeamsInstall extends Document {
  org_id:               Types.ObjectId;
  team_id:              string;
  tenant_id:            string;
  team_name:            string;
  bot_token_encrypted:  string;
  service_url:          string;
  conversation_id:      string;
  installed_at:         Date;
}

const TeamsInstallSchema = new Schema<ITeamsInstall>({
  org_id:               { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  team_id:              { type: String, required: true },
  tenant_id:            { type: String, default: '' },
  team_name:            { type: String, default: '' },
  bot_token_encrypted:  { type: String, required: true },
  service_url:          { type: String, default: 'https://smba.trafficmanager.net/apis/' },
  conversation_id:      { type: String, default: '' },
  installed_at:         { type: Date, default: Date.now },
}, { timestamps: false });

TeamsInstallSchema.index({ org_id: 1 }, { unique: true });
TeamsInstallSchema.index({ team_id: 1 });

export const TeamsInstall: Model<ITeamsInstall> =
  mongoose.models.TeamsInstall ?? mongoose.model<ITeamsInstall>('TeamsInstall', TeamsInstallSchema);
