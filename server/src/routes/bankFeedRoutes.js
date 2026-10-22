import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { categorizeTransaction, generateTransactions, getSubscriptionIntelligence, listTransactions, parseImport } from '../controllers/bankFeedController.js';

const router = Router();
router.use(authenticate);
router.get('/transactions', listTransactions);
router.get('/intelligence', getSubscriptionIntelligence);
router.post('/transactions/generate', generateTransactions);
router.post('/transactions/import', parseImport);
router.patch('/transactions/:id/category', categorizeTransaction);
export default router;
