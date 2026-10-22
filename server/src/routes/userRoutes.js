import { Router } from 'express';
import { changePassword, updateProfile, updateUserRole } from '../controllers/userController.js';
import { authenticate, authorize } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { validateObjectIdParam } from '../middleware/validateObjectIdParam.js';
import { validatePasswordChange, validateProfile } from '../validators/authValidators.js';
import {
  createSubscription, deleteSubscription, getSubscription, getSubscriptionCategories,
  getSubscriptionSummary, getUpcomingRenewals, listSubscriptions, trackSubscriptionUsage, updateSubscription, validateSubscriptionId
} from '../controllers/subscriptionController.js';
import { validateSubscription, validateSubscriptionSearch } from '../validators/subscriptionValidators.js';
import { listCancellationRequests, requestCancellation, completeCancellation, restoreCancellation } from '../controllers/cancellationController.js';
import { getNotificationPreferences, listNotifications, markAllNotificationsRead, markNotificationRead, unreadNotificationCount, updateNotificationPreferences } from '../controllers/notificationController.js';
import { getTrial, startTrial } from '../controllers/trialController.js';
import { loadDemoWorkspace, removeDemoWorkspace } from '../controllers/demoController.js';

const router = Router();
router.use(authenticate);
router.param('notificationId', (req, res, next) => validateObjectIdParam('notificationId', 'notification')(req, res, next));
router.param('requestId', (req, res, next) => validateObjectIdParam('requestId', 'cancellation request')(req, res, next));
router.post('/me/trial/start', startTrial);
router.get('/me/trial', getTrial);
router.get('/me/notifications/unread-count', unreadNotificationCount);
router.get('/me/notifications', listNotifications);
router.patch('/me/notifications/:notificationId/read', markNotificationRead);
router.post('/me/notifications/read-all', markAllNotificationsRead);
router.get('/me/notification-preferences', getNotificationPreferences);
router.put('/me/notification-preferences', updateNotificationPreferences);
router.post('/subscriptions/:id/cancellation-requests', validateSubscriptionId, requestCancellation);
router.get('/cancellation-requests', listCancellationRequests);
router.post('/cancellation-requests/:requestId/complete', completeCancellation);
router.post('/cancellation-requests/:requestId/restore', restoreCancellation);
router.post('/demo-workspace', loadDemoWorkspace);
router.delete('/demo-workspace', removeDemoWorkspace);
router.put('/me', validateRequest(validateProfile), updateProfile);
router.patch('/me/password', validateRequest(validatePasswordChange), changePassword);
router.get('/subscriptions/categories', getSubscriptionCategories);
router.get('/subscriptions/summary', getSubscriptionSummary);
router.get('/subscriptions/renewals/upcoming', getUpcomingRenewals);
router.post('/subscriptions/:id/usage', validateSubscriptionId, trackSubscriptionUsage);
router.get('/subscriptions', validateSubscriptionSearch, listSubscriptions);
router.post('/subscriptions', validateRequest((body) => validateSubscription(body)), createSubscription);
router.get('/subscriptions/:id', validateSubscriptionId, getSubscription);
router.patch('/subscriptions/:id', validateSubscriptionId, validateRequest((body) => validateSubscription(body, true)), updateSubscription);
router.delete('/subscriptions/:id', validateSubscriptionId, deleteSubscription);
router.patch('/:userId/role', validateObjectIdParam('userId', 'user'), authorize('PLATFORM_ADMIN'), updateUserRole);
export default router;
