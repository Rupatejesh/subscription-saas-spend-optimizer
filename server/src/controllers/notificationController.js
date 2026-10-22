import Notification from '../models/Notification.js';
import { syncScheduledNotifications, assertPreferencePatch } from '../services/notifications.js';
import { AppError } from '../utils/AppError.js';
import { apiResponse } from '../utils/apiResponse.js';

export async function listNotifications(req, res, next) {
  try {
    await syncScheduledNotifications(req.user);
    const filter = { user: req.user._id };
    if (req.query.unreadOnly === 'true') filter.readAt = null;
    const [notifications, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).limit(100).lean(),
      Notification.countDocuments({ user: req.user._id, readAt: null })
    ]);
    res.json(apiResponse({ notifications: notifications.map((item) => ({ ...item, id: String(item._id) })), unreadCount }));
  } catch (error) { next(error); }
}

export async function unreadNotificationCount(req, res, next) {
  try { const count = await Notification.countDocuments({ user: req.user._id, readAt: null }); res.json(apiResponse({ unreadCount: count })); }
  catch (error) { next(error); }
}

export async function markNotificationRead(req, res, next) {
  try {
    const notification = await Notification.findOneAndUpdate({ _id: req.params.notificationId, user: req.user._id }, { $set: { readAt: new Date() } }, { new: true });
    if (!notification) throw new AppError('Notification not found.', 404);
    res.json(apiResponse({ id: String(notification._id), readAt: notification.readAt }, 'Notification marked as read.'));
  } catch (error) { next(error); }
}

export async function markAllNotificationsRead(req, res, next) {
  try { const result = await Notification.updateMany({ user: req.user._id, readAt: null }, { $set: { readAt: new Date() } }); res.json(apiResponse({ updated: result.modifiedCount }, 'Notifications marked as read.')); }
  catch (error) { next(error); }
}

export function getNotificationPreferences(req, res) {
  res.json(apiResponse({ preferences: req.user.notificationPreferences }));
}

export async function updateNotificationPreferences(req, res, next) {
  try {
    const patch = assertPreferencePatch(req.body?.preferences);
    const preferences = { ...req.user.get('notificationPreferences'), ...patch };
    req.user.notificationPreferences = preferences;
    await req.user.save();
    res.json(apiResponse({ preferences: req.user.notificationPreferences }, 'Notification preferences updated.'));
  } catch (error) { next(error); }
}
