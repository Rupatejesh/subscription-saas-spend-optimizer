import mongoose from 'mongoose';

export const TRANSACTION_CATEGORIES = Object.freeze(['Entertainment', 'Productivity', 'Cloud Storage', 'Design', 'AI Tools', 'Utilities', 'Other']);
const transactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  merchant: { type: String, required: true, trim: true, maxlength: 120 },
  amount: { type: Number, required: true, min: 0, max: 1000000 },
  currency: { type: String, default: 'INR', uppercase: true, match: /^[A-Z]{3}$/ },
  date: { type: Date, required: true },
  category: { type: String, enum: TRANSACTION_CATEGORIES, default: 'Other' },
  possibleRecurring: { type: Boolean, default: false },
  confidenceScore: { type: Number, min: 0, max: 1, default: 0.5 },
  source: { type: String, enum: ['GENERATED', 'SIMULATED_IMPORT'], default: 'GENERATED' },
  isDemoData: { type: Boolean, default: false, index: true }
}, { timestamps: true, versionKey: false });
transactionSchema.index({ user: 1, date: -1 });
export default mongoose.model('Transaction', transactionSchema);
