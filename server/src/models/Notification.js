import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['RENEWAL', 'UNUSED', 'SAVINGS', 'SPENDING', 'CANCELLATION', 'TRIAL', 'TEAM', 'SECURITY'], required: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  message: { type: String, required: true, trim: true, maxlength: 500 },
  severity: { type: String, enum: ['INFO', 'WARNING', 'HIGH'], default: 'INFO' },
  readAt: { type: Date, default: null },
  relatedResource: { type: { type: String, enum: ['SUBSCRIPTION', 'CANCELLATION', 'TRIAL'] }, id: { type: mongoose.Schema.Types.ObjectId } },
  dedupeKey: { type: String, required: true, maxlength: 220 }
}, { timestamps: true, versionKey: false });

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, dedupeKey: 1 }, { unique: true });
notificationSchema.index({ user: 1, readAt: 1 });

export default mongoose.model('Notification', notificationSchema);
