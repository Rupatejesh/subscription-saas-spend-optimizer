import { Router } from 'express';
import { getPlatformMetrics, listPlatformTeams, listUsers } from '../controllers/adminController.js';
import { authenticate, authorize } from '../middleware/authenticate.js';

const router = Router();
router.use(authenticate, authorize('PLATFORM_ADMIN'));
router.get('/metrics', getPlatformMetrics);
router.get('/teams', listPlatformTeams);
router.get('/users', listUsers);
export default router;
