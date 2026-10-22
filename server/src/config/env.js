import dotenv from 'dotenv';

dotenv.config();

const required = ['MONGODB_URI'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  authCookieName: 'optimizer_session',
  platformAdminEmail: process.env.PLATFORM_ADMIN_EMAIL,
  platformAdminPassword: process.env.PLATFORM_ADMIN_PASSWORD,
  isProduction: process.env.NODE_ENV === 'production'
});

if (!env.jwtSecret || env.jwtSecret.length < 32 || (env.isProduction && env.jwtSecret === 'replace-with-a-long-random-local-development-secret')) {
  throw new Error('JWT_SECRET must contain at least 32 characters');
}
