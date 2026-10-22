import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { getPeerBenchmarks, getPersonalAlerts, getPersonalReport } from '../controllers/analyticsController.js';

const router = Router();
router.use(authenticate);
router.get('/alerts', getPersonalAlerts);
router.get('/reports', getPersonalReport);
router.get('/benchmarks', getPeerBenchmarks);
export default router;
