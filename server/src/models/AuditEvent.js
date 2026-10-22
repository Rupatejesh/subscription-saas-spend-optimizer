import mongoose from 'mongoose';

const auditEventSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  action: { type: String, required: true, trim: true, maxlength: 80 },
  targetType: { type: String, enum: ['USER', 'SUBSCRIPTION', 'CANCELLATION'], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  summary: { type: String, required: true, trim: true, maxlength: 240 }
}, { timestamps: true, versionKey: false });

auditEventSchema.index({ createdAt: -1 });
export default mongoose.model('AuditEvent', auditEventSchema);
