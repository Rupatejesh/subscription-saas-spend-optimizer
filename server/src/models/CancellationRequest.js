import mongoose from 'mongoose';

const cancellationRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true, index: true },
  subscriptionName: { type: String, required: true, trim: true, maxlength: 100 },
  reason: { type: String, enum: ['TOO_EXPENSIVE', 'UNUSED', 'DUPLICATE', 'SWITCHING', 'OTHER'], required: true },
  notes: { type: String, trim: true, maxlength: 500, default: '' },
  status: { type: String, enum: ['REQUESTED', 'COMPLETED', 'RESTORED'], default: 'REQUESTED', required: true },
  requestedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
  restoredAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });

cancellationRequestSchema.index({ user: 1, subscription: 1, status: 1 }, { unique: true, partialFilterExpression: { status: 'REQUESTED' } });
cancellationRequestSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('CancellationRequest', cancellationRequestSchema);
