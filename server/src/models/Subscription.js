import mongoose from 'mongoose';

export const SUBSCRIPTION_CATEGORIES = Object.freeze([
  'Entertainment', 'Productivity', 'Cloud Storage', 'Design', 'AI Tools', 'Utilities', 'Other'
]);
export const SUBSCRIPTION_STATUSES = Object.freeze(['ACTIVE', 'PAUSED', 'CANCELLATION_REQUESTED', 'CANCELLED']);

const subscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
  isShared: { type: Boolean, default: false, index: true },
  memberUsage: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, usageCount: { type: Number, min: 0, default: 0 }, usageMonth: { type: String, default: '' }, lastUsedAt: { type: Date, default: null } }],
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
  category: { type: String, enum: SUBSCRIPTION_CATEGORIES, default: 'Other' },
  amount: { type: Number, required: true, min: 0, max: 1000000 },
  currency: { type: String, default: 'INR', uppercase: true, match: /^[A-Z]{3}$/ },
  billingCycle: { type: String, enum: ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'], default: 'MONTHLY' },
  nextRenewalDate: { type: Date, required: true },
  status: { type: String, enum: SUBSCRIPTION_STATUSES, default: 'ACTIVE' },
  lastUsedAt: { type: Date, default: null },
  usageCount: { type: Number, min: 0, default: 0 },
  usageMonth: { type: String, default: '' },
  monthlyUsageTarget: { type: Number, min: 1, max: 1000, default: 12 },
  notes: { type: String, trim: true, maxlength: 500, default: '' },
  isDemoData: { type: Boolean, default: false, index: true }
}, { timestamps: true, versionKey: false });

subscriptionSchema.index({ user: 1, nextRenewalDate: 1 });
subscriptionSchema.index({ user: 1, name: 1 }, { unique: true, partialFilterExpression: { isDemoData: true } });
export default mongoose.model('Subscription', subscriptionSchema);


