import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import adminRoutes from './adminRoutes.js';
import bankFeedRoutes from './bankFeedRoutes.js';
import teamRoutes from './teamRoutes.js';
import analyticsRoutes from './analyticsRoutes.js';

const router = Router();
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users/me', analyticsRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);
router.use('/bank-feed', bankFeedRoutes);
router.use('/teams', teamRoutes);
export default router;



