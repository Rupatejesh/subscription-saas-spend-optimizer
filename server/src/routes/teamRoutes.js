import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validateObjectIdParam } from '../middleware/validateObjectIdParam.js';
import { getTeamAlerts, getTeamReport } from '../controllers/analyticsController.js';
import {
  createTeam, listTeams, getTeam, updateTeam, inviteMember, acceptInvitation, listMyInvitations,
  removeMember, updateMemberRole, addSharedSubscription, updateSharedSubscription,
  removeSharedSubscription, getDashboard, trackTeamSubscriptionUsage
} from '../controllers/teamController.js';

const router = Router();
router.use(authenticate);
router.param('teamId', (req, res, next) => validateObjectIdParam('teamId', 'team')(req, res, next));
router.param('invitationId', (req, res, next) => validateObjectIdParam('invitationId', 'invitation')(req, res, next));
router.param('memberId', (req, res, next) => validateObjectIdParam('memberId', 'member')(req, res, next));
router.param('subscriptionId', (req, res, next) => validateObjectIdParam('subscriptionId', 'subscription')(req, res, next));
router.get('/', listTeams);
router.post('/', createTeam);
router.get('/invitations/me', listMyInvitations);
router.post('/invitations/:invitationId/accept', acceptInvitation);
router.get('/:teamId', getTeam);
router.patch('/:teamId', updateTeam);
router.get('/:teamId/dashboard', getDashboard);
router.get('/:teamId/alerts', getTeamAlerts);
router.get('/:teamId/reports', getTeamReport);
router.post('/:teamId/invitations', inviteMember);
router.patch('/:teamId/members/:memberId', updateMemberRole);
router.delete('/:teamId/members/:memberId', removeMember);
router.post('/:teamId/subscriptions', addSharedSubscription);
router.post('/:teamId/subscriptions/:subscriptionId/usage', trackTeamSubscriptionUsage);
router.patch('/:teamId/subscriptions/:subscriptionId', updateSharedSubscription);
router.delete('/:teamId/subscriptions/:subscriptionId', removeSharedSubscription);
export default router;


