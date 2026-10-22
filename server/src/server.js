import app from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';

try {
  await connectDatabase();
  app.listen(env.port, () => console.info(`API listening on port ${env.port}`));
} catch (error) {
  console.error('Server startup failed:', error.message);
  process.exitCode = 1;
}