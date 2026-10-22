import mongoose from 'mongoose';
import CancellationRequest from '../models/CancellationRequest.js';
import Subscription from '../models/Subscription.js';
import AuditEvent from '../models/AuditEvent.js';
import { createUserNotification } from '../services/notifications.js';
import { AppError } from '../utils/AppError.js';
import { apiResponse } from '../utils/apiResponse.js';

const REASONS = new Set(['TOO_EXPENSIVE', 'UNUSED', 'DUPLICATE', 'SWITCHING', 'OTHER']);
const own = (user, subscription) => ({ user, _id: subscription, team: null });

export async function listCancellationRequests(req, res, next) {
  try {
    const filter = { user: req.user._id };
    if (req.query.subscriptionId) {
      if (!mongoose.isValidObjectId(req.query.subscriptionId)) throw new AppError('Subscription not found.', 404);
      filter.subscription = req.query.subscriptionId;
    }
    const requests = await CancellationRequest.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    res.json(apiResponse({ requests: requests.map((item) => ({ ...item, id: String(item._id), subscriptionId: String(item.subscription) })) }));
  } catch (error) { next(error); }
}

export async function requestCancellation(req, res, next) {
  try {
    const { reason, notes = '' } = req.body ?? {};
    if (!REASONS.has(reason) || typeof notes !== 'string' || notes.length > 500) throw new AppError('Choose a valid cancellation reason and notes under 500 characters.', 400);
    const subscription = await Subscription.findOne(own(req.user._id, req.params.id));
    if (!subscription) throw new AppError('Subscription not found.', 404);
    if (subscription.status !== 'ACTIVE') throw new AppError('Only an active subscription can enter cancellation review.', 409);
    const active = await CancellationRequest.exists({ user: req.user._id, subscription: subscription._id, status: 'REQUESTED' });
    if (active) throw new AppError('An active cancellation request already exists.', 409);
    const request = await CancellationRequest.create({ user: req.user._id, subscription: subscription._id, subscriptionName: subscription.name, reason, notes: notes.trim() });
    subscription.status = 'CANCELLATION_REQUESTED';
    await subscription.save();
    await AuditEvent.create({ actor: req.user._id, action: 'CANCELLATION_REQUESTED', targetType: 'CANCELLATION', targetId: request._id, summary: `Cancellation review requested for ${subscription.name}.` });
    await createUserNotification(req.user, { type: 'CANCELLATION', severity: 'INFO', title: 'Cancellation review started', message: `Your request for ${subscription.name} is recorded in this application. No external service was changed.`, dedupeKey: `cancellation-request:${request._id}`, relatedResource: { type: 'CANCELLATION', id: request._id } });
    res.status(201).json(apiResponse({ request: { ...request.toObject(), id: String(request._id), subscriptionId: String(subscription._id) }, subscriptionStatus: subscription.status }, 'Cancellation review started in this application.'));
  } catch (error) {
    if (error.code === 11000) return next(new AppError('An active cancellation request already exists.', 409));
    next(error);
  }
}

async function ownedRequest(req) {
  const request = await CancellationRequest.findOne({ _id: req.params.requestId, user: req.user._id });
  if (!request) throw new AppError('Cancellation request not found.', 404);
  return request;
}

export async function completeCancellation(req, res, next) {
  try {
    const request = await ownedRequest(req);
    if (request.status !== 'REQUESTED') throw new AppError('Only a requested cancellation can be marked complete.', 409);
    const subscription = await Subscription.findOne(own(req.user._id, request.subscription));
    if (!subscription) throw new AppError('Subscription not found.', 404);
    request.status = 'COMPLETED'; request.completedAt = new Date();
    subscription.status = 'CANCELLED';
    await Promise.all([request.save(), subscription.save()]);
    await AuditEvent.create({ actor: req.user._id, action: 'CANCELLATION_COMPLETED_IN_APP', targetType: 'CANCELLATION', targetId: request._id, summary: `${request.subscriptionName} marked cancelled in the application.` });
    await createUserNotification(req.user, { type: 'CANCELLATION', severity: 'INFO', title: 'Application status updated', message: `${request.subscriptionName} is marked cancelled in this app. Contact the provider separately to cancel an external service.`, dedupeKey: `cancellation-completed:${request._id}`, relatedResource: { type: 'CANCELLATION', id: request._id } });
    res.json(apiResponse({ request, subscriptionStatus: subscription.status }, 'Marked cancelled in this application; no provider was contacted.'));
  } catch (error) { next(error); }
}

export async function restoreCancellation(req, res, next) {
  try {
    const request = await ownedRequest(req);
    if (!['REQUESTED', 'COMPLETED'].includes(request.status)) throw new AppError('This cancellation request cannot be restored.', 409);
    const subscription = await Subscription.findOne(own(req.user._id, request.subscription));
    if (!subscription) throw new AppError('Subscription not found.', 404);
    request.status = 'RESTORED'; request.restoredAt = new Date();
    subscription.status = 'ACTIVE';
    await Promise.all([request.save(), subscription.save()]);
    await AuditEvent.create({ actor: req.user._id, action: 'CANCELLATION_RESTORED', targetType: 'CANCELLATION', targetId: request._id, summary: `${request.subscriptionName} restored in the application.` });
    res.json(apiResponse({ request, subscriptionStatus: subscription.status }, 'Subscription restored in this application.'));
  } catch (error) { next(error); }
}
