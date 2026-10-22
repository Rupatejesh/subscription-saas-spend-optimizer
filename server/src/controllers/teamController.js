import Team from '../models/Team.js';
import TeamInvitation from '../models/TeamInvitation.js';
import Subscription from '../models/Subscription.js';
import User, { toPublicUser } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { apiResponse } from '../utils/apiResponse.js';
import { createUserNotification } from '../services/notifications.js';

const roles = ['ADMIN', 'MEMBER'];
const monthlyAmount = (item) => {
  const amount = Number(item.amount) || 0;
  return item.billingCycle === 'YEARLY' ? amount / 12 : item.billingCycle === 'QUARTERLY' ? amount / 3 : item.billingCycle === 'WEEKLY' ? amount * 52 / 12 : amount;
};
async function getMembership(teamId, userId) {
  const team = await Team.findById(teamId);
  if (!team) throw new AppError('Team not found.', 404);
  const member = team.members.find((item) => String(item.user) === String(userId));
  if (!member) throw new AppError('You are not a member of this team.', 403);
  return { team, member };
}
function requireManager(member) {
  if (!['OWNER', 'ADMIN'].includes(member.role)) throw new AppError('Team owner or admin access is required.', 403);
}
async function notifyTeam(team, title, message, dedupeKey, resourceId) {
  const members = await User.find({ _id: { $in: team.members.map((member) => member.user) } });
  await Promise.all(members.map((user) => createUserNotification(user, { type: 'TEAM', severity: 'INFO', title, message, dedupeKey: `team:${team._id}:${dedupeKey}`, relatedResource: resourceId ? { type: 'SUBSCRIPTION', id: resourceId } : undefined })));
}
function publicTeam(team) {
  return { id: String(team._id), name: team.name, description: team.description, currency: team.currency, createdAt: team.createdAt,
    members: team.members.map((m) => ({ id: String(m.user), email: m.email, role: m.role, joinedAt: m.joinedAt })) };
}
export async function listTeams(req, res, next) {
  try { const teams = await Team.find({ 'members.user': req.user._id }); res.json(apiResponse({ teams: teams.map(publicTeam) })); } catch (e) { next(e); }
}
export async function createTeam(req, res, next) {
  try {
    const { name, description = '', currency = 'INR' } = req.body ?? {};
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) throw new AppError('Team name must be between 2 and 100 characters.', 400);
    if (typeof description !== 'string' || description.length > 500 || !/^[A-Za-z]{3}$/.test(currency)) throw new AppError('Enter a valid description and three-letter currency code.', 400);
    const team = await Team.create({ name: name.trim(), description: description.trim(), currency, members: [{ user: req.user._id, email: req.user.email, role: 'OWNER' }] });
    await User.updateOne({ _id: req.user._id, role: 'USER' }, { $set: { role: 'TEAM_ADMIN' } });
    res.status(201).json(apiResponse({ team: publicTeam(team) }, 'Team created.'));
  } catch (e) { next(e); }
}
export async function getTeam(req, res, next) {
  try { const { team } = await getMembership(req.params.teamId, req.user._id); res.json(apiResponse({ team: publicTeam(team) })); } catch (e) { next(e); }
}
export async function updateTeam(req, res, next) {
  try {
    const { team, member } = await getMembership(req.params.teamId, req.user._id); requireManager(member);
    const { name, description, currency } = req.body ?? {};
    if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100)) throw new AppError('Team name must be between 2 and 100 characters.', 400);
    if (description !== undefined && (typeof description !== 'string' || description.length > 500)) throw new AppError('Description must be 500 characters or fewer.', 400);
    if (currency !== undefined && !/^[A-Za-z]{3}$/.test(currency)) throw new AppError('Currency must be a three-letter code.', 400);
    if (name !== undefined) team.name = name.trim(); if (description !== undefined) team.description = description.trim(); if (currency !== undefined) team.currency = currency.toUpperCase();
    await team.save(); res.json(apiResponse({ team: publicTeam(team) }, 'Team updated.'));
  } catch (e) { next(e); }
}
export async function inviteMember(req, res, next) {
  try {
    const { team, member } = await getMembership(req.params.teamId, req.user._id); requireManager(member);
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const role = req.body?.role ?? 'MEMBER';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !roles.includes(role)) throw new AppError('Enter a valid email and member role.', 400);
    if (team.members.some((item) => item.email === email)) throw new AppError('This person is already a team member.', 409);
    const existing = await TeamInvitation.findOne({ team: team._id, email, status: 'PENDING' });
    if (existing) throw new AppError('A pending invitation already exists for this email.', 409);
    const invitation = await TeamInvitation.create({ team: team._id, email, role, invitedBy: req.user._id });
    res.status(201).json(apiResponse({ invitation: { id: String(invitation._id), email, role, status: invitation.status, createdAt: invitation.createdAt } }, 'Invitation created. The invited user must sign in with this email to accept.'));
  } catch (e) { next(e); }
}
export async function acceptInvitation(req, res, next) {
  try {
    const invitation = await TeamInvitation.findById(req.params.invitationId);
    if (!invitation || invitation.status !== 'PENDING') throw new AppError('Pending invitation not found.', 404);
    if (invitation.email !== req.user.email) throw new AppError('Sign in with the email address that received this invitation.', 403);
    const team = await Team.findById(invitation.team);
    if (!team) throw new AppError('Team not found.', 404);
    if (team.members.some((item) => String(item.user) === String(req.user._id))) throw new AppError('You are already a team member.', 409);
    team.members.push({ user: req.user._id, email: req.user.email, role: invitation.role });
    await team.save(); invitation.status = 'ACCEPTED'; await invitation.save();
    res.json(apiResponse({ team: publicTeam(team) }, 'Invitation accepted.'));
  } catch (e) { next(e); }
}
export async function updateMemberRole(req, res, next) {
  try {
    const { team, member } = await getMembership(req.params.teamId, req.user._id); requireManager(member);
    const target = team.members.find((item) => String(item.user) === req.params.memberId);
    const role = req.body?.role;
    if (!target) throw new AppError('Team member not found.', 404);
    if (target.role === 'OWNER') throw new AppError('The owner role cannot be reassigned here.', 400);
    if (!roles.includes(role)) throw new AppError('Role must be ADMIN or MEMBER.', 400);
    target.role = role; await team.save(); res.json(apiResponse({ team: publicTeam(team) }, 'Member role updated.'));
  } catch (e) { next(e); }
}
export async function removeMember(req, res, next) {
  try {
    const { team, member } = await getMembership(req.params.teamId, req.user._id); requireManager(member);
    if (String(member.user) === req.params.memberId) throw new AppError('You cannot remove yourself from this team.', 400);
    const target = team.members.find((item) => String(item.user) === req.params.memberId);
    if (!target) throw new AppError('Team member not found.', 404);
    if (target.role === 'OWNER') throw new AppError('The team owner cannot be removed.', 400);
    team.members = team.members.filter((item) => String(item.user) !== req.params.memberId); await team.save();
    res.json(apiResponse({ team: publicTeam(team) }, 'Member removed.'));
  } catch (e) { next(e); }
}
export async function addSharedSubscription(req, res, next) {
  try {
    const { team, member } = await getMembership(req.params.teamId, req.user._id); requireManager(member);
    const { name, category = 'Other', amount, billingCycle = 'MONTHLY', nextRenewalDate, monthlyUsageTarget = 12 } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim() || name.length > 100 || !Number.isFinite(amount) || amount < 0 || amount > 1000000 || !['WEEKLY','MONTHLY','QUARTERLY','YEARLY'].includes(billingCycle) || !Number.isFinite(Date.parse(nextRenewalDate))) throw new AppError('Enter a name, valid amount, billing cycle, and renewal date.', 400);
    const subscription = await Subscription.create({ user: req.user._id, team: team._id, isShared: true, name: name.trim(), category, amount, currency: team.currency, billingCycle, nextRenewalDate, monthlyUsageTarget });
    await notifyTeam(team, 'Shared subscription added', `${subscription.name} was added to ${team.name}. Its spend is simulated and entered by team members.`, `subscription-added:${subscription._id}`, subscription._id);
    res.status(201).json(apiResponse({ subscription }, 'Shared subscription added.'));
  } catch (e) { next(e); }
}
export async function trackTeamSubscriptionUsage(req, res, next) {
  try {
    const { team } = await getMembership(req.params.teamId, req.user._id);
    const subscription = await Subscription.findOne({ _id: req.params.subscriptionId, team: team._id, isShared: true, status: 'ACTIVE' });
    if (!subscription) throw new AppError('Active shared subscription not found.', 404);
    const month = new Date().toISOString().slice(0, 7);
    let record = subscription.memberUsage.find((item) => String(item.user) === String(req.user._id));
    if (!record) { subscription.memberUsage.push({ user: req.user._id, usageCount: 1, usageMonth: month, lastUsedAt: new Date() }); }
    else { record.usageCount = record.usageMonth === month ? record.usageCount + 1 : 1; record.usageMonth = month; record.lastUsedAt = new Date(); }
    subscription.lastUsedAt = new Date();
    await subscription.save();
    res.json(apiResponse({ subscriptionId: String(subscription._id), usageCount: subscription.memberUsage.find((item) => String(item.user) === String(req.user._id)).usageCount, usageMonth: month }, 'Team usage recorded.'));
  } catch (error) { next(error); }
}

export async function updateSharedSubscription(req, res, next) {
  try {
    const { team, member } = await getMembership(req.params.teamId, req.user._id); requireManager(member);
    const subscription = await Subscription.findOne({ _id: req.params.subscriptionId, team: team._id, isShared: true });
    if (!subscription) throw new AppError('Shared subscription not found.', 404);
    const allowed = ['name', 'category', 'amount', 'billingCycle', 'nextRenewalDate', 'status', 'monthlyUsageTarget'];
    if (req.body?.status === 'CANCELLATION_REQUESTED') throw new AppError('Team cancellation review is not available through this personal workflow.', 400);
    for (const key of allowed) if (req.body?.[key] !== undefined) subscription[key] = req.body[key];
    await subscription.save();
    await notifyTeam(team, 'Shared subscription updated', `${subscription.name} was updated in ${team.name}.`, `subscription-updated:${subscription._id}:${subscription.updatedAt.getTime()}`, subscription._id);
    res.json(apiResponse({ subscription }, 'Shared subscription updated.'));
  } catch (e) { next(e); }
}
export async function removeSharedSubscription(req, res, next) {
  try {
    const { team, member } = await getMembership(req.params.teamId, req.user._id); requireManager(member);
    const result = await Subscription.deleteOne({ _id: req.params.subscriptionId, team: team._id, isShared: true });
    if (!result.deletedCount) throw new AppError('Shared subscription not found.', 404);
    await notifyTeam(team, 'Shared subscription removed', 'A shared subscription was removed from the team workspace.', `subscription-removed:${req.params.subscriptionId}:${Date.now()}`, req.params.subscriptionId);
    res.json(apiResponse({ id: req.params.subscriptionId }, 'Shared subscription removed.'));
  } catch (e) { next(e); }
}
export async function getDashboard(req, res, next) {
  try {
    const { team } = await getMembership(req.params.teamId, req.user._id);
    const [subscriptions, users, invitations] = await Promise.all([
      Subscription.find({ team: team._id, isShared: true }).sort({ nextRenewalDate: 1 }),
      User.find({ _id: { $in: team.members.map((m) => m.user) } }).select('name email'),
      TeamInvitation.find({ team: team._id, status: 'PENDING' }).select('email role status createdAt')
    ]);
    const now = new Date(); const soon = new Date(now.getTime() + 30 * 86400000);
    const active = subscriptions.filter((s) => s.status === 'ACTIVE');
    const totalMonthly = active.reduce((sum, s) => sum + monthlyAmount(s), 0);
    const month = now.toISOString().slice(0, 7);
    const usageByMember = new Map();
    for (const sub of active) {
      sub.usageCount = sub.memberUsage.filter((item) => item.usageMonth === month).reduce((sum, item) => sum + item.usageCount, 0);
      for (const item of sub.memberUsage.filter((entry) => entry.usageMonth === month)) {
        const key = String(item.user); usageByMember.set(key, (usageByMember.get(key) ?? 0) + item.usageCount);
      }
    }
    const unused = active.filter((s) => s.usageCount < 3);
    const memberUsage = team.members.map((m) => ({ id: String(m.user), email: m.email, role: m.role, name: users.find((u) => String(u._id) === String(m.user))?.name ?? m.email, usageCount: usageByMember.get(String(m.user)) ?? 0 }));
    const renewalAlerts = active.filter((s) => new Date(s.nextRenewalDate) <= soon).map((s) => ({ subscriptionId: String(s._id), name: s.name, renewalDate: s.nextRenewalDate, amount: s.amount, currency: s.currency }));
    const unusedList = unused.map((s) => ({ id: String(s._id), name: s.name, monthlySpend: monthlyAmount(s), usageCount: s.usageCount }));
    res.json(apiResponse({ simulatedData: true, team: publicTeam(team), metrics: { teamMonthlySpend: totalMonthly, sharedSubscriptions: active.length, unusedServices: unused.length, potentialTeamSavings: unused.reduce((sum, s) => sum + monthlyAmount(s), 0), memberCount: team.members.length }, subscriptions, unusedServices: unusedList, memberUsage, renewals: renewalAlerts, pendingInvitations: invitations }));
  } catch (e) { next(e); }
}

export async function listMyInvitations(req, res, next) {
  try {
    const invitations = await TeamInvitation.find({ email: req.user.email, status: 'PENDING' }).populate('team', 'name description currency');
    res.json(apiResponse({ invitations: invitations.map((item) => ({ id: String(item._id), team: item.team, role: item.role, createdAt: item.createdAt })) }));
  } catch (error) { next(error); }
}



