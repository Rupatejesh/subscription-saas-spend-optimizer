import User, { toPublicUser } from '../models/User.js';
import { apiResponse } from '../utils/apiResponse.js';
import mongoose from 'mongoose';
import Subscription from '../models/Subscription.js';
import Team from '../models/Team.js';
import AuditEvent from '../models/AuditEvent.js';

export async function listUsers(req, res, next) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const [users, total] = await Promise.all([
      User.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      User.countDocuments()
    ]);
    res.json(apiResponse({ users: users.map(toPublicUser), page, limit, total }));
  } catch (error) { next(error); }
}

export async function getPlatformMetrics(_req, res, next) {
  try {
    const [totalUsers, activeTrialUsers, expiredTrialUsers, teamCount, subscriptionCounts, spend, recentActivity] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ trialStatus: 'TRIAL_ACTIVE' }),
      User.countDocuments({ trialStatus: 'TRIAL_EXPIRED' }),
      Team.countDocuments(),
      Subscription.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Subscription.aggregate([
        { $match: { status: 'ACTIVE' } },
        { $project: { amount: 1, lastUsedAt: 1, currency: 1, factor: { $switch: { branches: [
          { case: { $eq: ['$billingCycle', 'WEEKLY'] }, then: 52 / 12 },
          { case: { $eq: ['$billingCycle', 'QUARTERLY'] }, then: 1 / 3 },
          { case: { $eq: ['$billingCycle', 'YEARLY'] }, then: 1 / 12 }
        ], default: 1 } } } },
        { $group: { _id: '$currency', monthlySpend: { $sum: { $multiply: ['$amount', '$factor'] } }, potentialSavings: { $sum: { $cond: [{ $or: [{ $eq: ['$lastUsedAt', null] }, { $lt: ['$lastUsedAt', new Date(Date.now() - 30 * 86400000)] }] }, { $multiply: ['$amount', '$factor'] }, 0] } } } }
      ]),
      AuditEvent.find().sort({ createdAt: -1 }).limit(10).populate('actor', 'name email').lean()
    ]);
    const byStatus = Object.fromEntries(subscriptionCounts.map((row) => [row._id, row.count]));
    res.json(apiResponse({
      generatedAt: new Date(), system: { database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' },
      users: { total: totalUsers, activeTrials: activeTrialUsers, expiredTrials: expiredTrialUsers }, teams: { total: teamCount },
      subscriptions: { active: byStatus.ACTIVE ?? 0, cancellationRequested: byStatus.CANCELLATION_REQUESTED ?? 0, cancelled: byStatus.CANCELLED ?? 0, paused: byStatus.PAUSED ?? 0 },
      simulatedSpend: spend.map((row) => ({ currency: row._id || 'INR', monthly: Number(row.monthlySpend.toFixed(2)), potentialMonthlySavings: Number(row.potentialSavings.toFixed(2)) })),
      recentActivity: recentActivity.map((event) => ({ id: String(event._id), action: event.action, targetType: event.targetType, targetId: String(event.targetId), summary: event.summary, actor: event.actor ? { name: event.actor.name, email: event.actor.email } : null, createdAt: event.createdAt }))
    }));
  } catch (error) { next(error); }
}

export async function listPlatformTeams(_req, res, next) {
  try {
    const teams = await Team.find().sort({ createdAt: -1 }).lean();
    const teamIds = teams.map((team) => team._id);
    const sharedPlans = teamIds.length ? await Subscription.aggregate([
      { $match: { team: { $in: teamIds }, isShared: true } },
      { $project: { team: 1, status: 1, amount: 1, factor: { $switch: { branches: [
        { case: { $eq: ['$billingCycle', 'WEEKLY'] }, then: 52 / 12 },
        { case: { $eq: ['$billingCycle', 'QUARTERLY'] }, then: 1 / 3 },
        { case: { $eq: ['$billingCycle', 'YEARLY'] }, then: 1 / 12 }
      ], default: 1 } } } },
      { $group: { _id: { team: '$team', status: '$status' }, count: { $sum: 1 }, monthlySpend: { $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, { $multiply: ['$amount', '$factor'] }, 0] } } } }
    ]) : [];
    const teamsData = teams.map((team) => {
      const records = sharedPlans.filter((row) => String(row._id.team) === String(team._id));
      return { id: String(team._id), name: team.name, description: team.description, currency: team.currency, createdAt: team.createdAt, memberCount: team.members.length,
        sharedSubscriptions: records.reduce((sum, row) => sum + row.count, 0), activeSharedSubscriptions: records.filter((row) => row._id.status === 'ACTIVE').reduce((sum, row) => sum + row.count, 0),
        monthlySpend: Number(records.reduce((sum, row) => sum + row.monthlySpend, 0).toFixed(2)) };
    });
    res.json(apiResponse({ teams: teamsData, total: teamsData.length, simulatedData: true }));
  } catch (error) { next(error); }
}
