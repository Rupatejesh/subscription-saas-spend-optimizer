import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  role: { type: String, enum: ['OWNER', 'ADMIN', 'MEMBER'], default: 'MEMBER' },
  joinedAt: { type: Date, default: Date.now }
}, { _id: false });

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  currency: { type: String, uppercase: true, match: /^[A-Z]{3}$/, default: 'INR' },
  members: { type: [memberSchema], default: [] }
}, { timestamps: true, versionKey: false });
teamSchema.index({ 'members.user': 1 });
export default mongoose.model('Team', teamSchema);
