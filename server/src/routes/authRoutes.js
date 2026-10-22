import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getSession, login, logout, register } from '../controllers/authController.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { validateLogin, validateRegistration } from '../validators/authValidators.js';

const router = Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, message: 'Too many sign-in attempts. Try again later.' } });
const registrationLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, message: 'Too many account creation attempts. Try again later.' } });
router.post('/register', registrationLimiter, validateRequest(validateRegistration), register);
router.post('/login', loginLimiter, validateRequest(validateLogin), login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getSession);
export default router;
