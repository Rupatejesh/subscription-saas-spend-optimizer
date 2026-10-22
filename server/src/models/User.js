import mongoose from 'mongoose';

export const USER_ROLES = Object.freeze({
  USER: 'USER',
  TEAM_ADMIN: 'TEAM_ADMIN',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN'
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: Object.values(USER_ROLES), default: USER_ROLES.USER, required: true },
  sessionVersion: { type: Number, default: 0, select: false },
  trialStartedAt: { type: Date, default: null },
  trialEndsAt: { type: Date, default: null },
  trialStatus: { type: String, enum: ['TRIAL_NOT_STARTED', 'TRIAL_ACTIVE', 'TRIAL_EXPIRED', 'ACTIVE_PLAN'], default: 'TRIAL_NOT_STARTED' },
  notificationPreferences: {
    renewals: { type: Boolean, default: true },
    unused: { type: Boolean, default: true },
    savings: { type: Boolean, default: true },
    spending: { type: Boolean, default: true },
    team: { type: Boolean, default: true },
    trial: { type: Boolean, default: true }
  }
}, { timestamps: true, versionKey: false });

export function toPublicUser(user) {
  return { id: String(user._id), name: user.name, email: user.email, role: user.role };
}

export default mongoose.model('User', userSchema);
