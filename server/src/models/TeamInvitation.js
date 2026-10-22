import mongoose from 'mongoose';

const invitationSchema = new mongoose.Schema({
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  role: { type: String, enum: ['ADMIN', 'MEMBER'], default: 'MEMBER' },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REVOKED'], default: 'PENDING' }
}, { timestamps: true, versionKey: false });
invitationSchema.index({ team: 1, email: 1, status: 1 });
export default mongoose.model('TeamInvitation', invitationSchema);
