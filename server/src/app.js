import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import apiRoutes from './routes/index.js';
import { apiResponse } from './utils/apiResponse.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
app.set('trust proxy', env.isProduction ? 1 : false);
app.get('/', (_req, res) => res.json(apiResponse({ name: 'Subscription & SaaS Spend Optimizer API' })));
app.use('/api/v1', apiRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
