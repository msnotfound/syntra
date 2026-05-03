import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IUser extends Document {
  clerk_user_id: string;
  email: string;
  name: string;
  org_id: Types.ObjectId;
  role: 'owner' | 'admin' | 'member';
  created_at: Date;
  last_seen_at: Date;
}

const UserSchema = new Schema<IUser>({
  clerk_user_id: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  name:  { type: String, required: true },
  org_id: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  role:  { type: String, enum: ['owner','admin','member'], default: 'member' },
  last_seen_at: { type: Date, default: Date.now },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

UserSchema.index({ org_id: 1 });

export const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>('User', UserSchema);
