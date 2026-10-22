import bcrypt from 'bcryptjs';
import { connectDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import User, { USER_ROLES } from '../src/models/User.js';
import { validateEmail, validatePassword } from '../src/validators/authValidators.js';

if (!validateEmail(env.platformAdminEmail) || !validatePassword(env.platformAdminPassword)) {
  throw new Error('Set valid PLATFORM_ADMIN_EMAIL and a 12–128 character PLATFORM_ADMIN_PASSWORD in server/.env.');
}

await connectDatabase();
const email = env.platformAdminEmail.trim().toLowerCase();
const existing = await User.findOne({ email });
if (existing) {
  if (existing.role !== USER_ROLES.PLATFORM_ADMIN) {
    throw new Error('That email already belongs to a non-admin account; bootstrap did not change its role.');
  }
  console.info('Platform admin already exists; no changes made.');
} else {
  const passwordHash = await bcrypt.hash(env.platformAdminPassword, 12);
  await User.create({ name: 'Platform Admin', email, passwordHash, role: USER_ROLES.PLATFORM_ADMIN });
  console.info('Initial platform admin created. Remove bootstrap credentials from server/.env.');
}
await User.db.close();
