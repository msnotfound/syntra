import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOrganization extends Document {
  name: string;
  slug: string;
  plan: 'trial' | 'starter' | 'growth' | 'enterprise';
  status: 'active' | 'suspended' | 'cancelled';
  trial_ends_at: Date;
  razorpay_customer_id: string | null;
  razorpay_subscription_id: string | null;
  contact_email: string;
  contact_phone: string | null;
  industry: string | null;
  settings: {
    alert_channels: ('email' | 'whatsapp' | 'webhook')[];
    webhook_url: string | null;
    severity_threshold: 'critical' | 'high' | 'medium' | 'low';
    quiet_hours_start: string | null;
    quiet_hours_end: string | null;
    timezone: string;
  };
  demo_mode: boolean;
  created_at: Date;
  updated_at: Date;
}

const OrgSchema = new Schema<IOrganization>({
  name:  { type: String, required: true },
  slug:  { type: String, required: true, unique: true, lowercase: true, trim: true },
  plan:  { type: String, enum: ['trial','starter','growth','enterprise'], default: 'trial' },
  status: { type: String, enum: ['active','suspended','cancelled'], default: 'active' },
  trial_ends_at: { type: Date, default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
  razorpay_customer_id: { type: String, default: null },
  razorpay_subscription_id: { type: String, default: null },
  contact_email: { type: String, required: true },
  contact_phone: { type: String, default: null },
  industry: { type: String, default: null },
  settings: {
    alert_channels: { type: [String], default: ['email'] },
    webhook_url: { type: String, default: null },
    severity_threshold: { type: String, enum: ['critical','high','medium','low'], default: 'high' },
    quiet_hours_start: { type: String, default: null },
    quiet_hours_end: { type: String, default: null },
    timezone: { type: String, default: 'Asia/Kolkata' },
  },
  demo_mode: { type: Boolean, default: false },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

OrgSchema.index({ razorpay_subscription_id: 1 });

export const Organization: Model<IOrganization> =
  mongoose.models.Organization ?? mongoose.model<IOrganization>('Organization', OrgSchema);
