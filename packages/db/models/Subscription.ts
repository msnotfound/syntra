import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ISubscription extends Document {
  org_id: Types.ObjectId;
  plan: 'trial' | 'starter' | 'growth' | 'enterprise';
  status: 'active' | 'halted' | 'cancelled' | 'completed';
  razorpay_subscription_id: string | null;
  razorpay_customer_id: string | null;
  current_period_start: Date;
  current_period_end: Date;
  amount_paise: number;
  created_at: Date;
  updated_at: Date;
}

const SubscriptionSchema = new Schema<ISubscription>({
  org_id: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  plan:   { type: String, enum: ['trial','starter','growth','enterprise'], required: true },
  status: { type: String, enum: ['active','halted','cancelled','completed'], default: 'active' },
  razorpay_subscription_id: { type: String, default: null },
  razorpay_customer_id: { type: String, default: null },
  current_period_start: { type: Date, required: true },
  current_period_end:   { type: Date, required: true },
  amount_paise: { type: Number, default: 0 },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

SubscriptionSchema.index({ org_id: 1 });
SubscriptionSchema.index({ razorpay_subscription_id: 1 });

export const Subscription: Model<ISubscription> =
  mongoose.models.Subscription ?? mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
