import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../services/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';

export function NotificationCenter() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [loading, setLoading] = useState(false);
  const [ownerId, setOwnerId] = useState(null);
  const currentUserId = useRef(user?.id ?? null);
  currentUserId.current = user?.id ?? null;

  async function load(accountId = user?.id) {
    if (!accountId) return;
    setLoading(true);
    try { const data = await apiRequest('/users/me/notifications'); if (currentUserId.current !== accountId) return; setNotifications(data.notifications); setUnreadCount(data.unreadCount); setOwnerId(accountId); setError(''); }
    catch (requestError) { if (currentUserId.current === accountId) setError(requestError.message); }
    finally { if (currentUserId.current === accountId) setLoading(false); }
  }
  useEffect(() => {
    setNotifications([]); setUnreadCount(0); setError(''); setOwnerId(user?.id ?? null); setBusyId(''); setLoading(Boolean(user));
    if (user) load(user.id);
  }, [user?.id]);
  async function markRead(id) {
    const accountId = user?.id;
    if (!accountId || busyId) return;
    setBusyId(id);
    try { await apiRequest(`/users/me/notifications/${id}/read`, { method: 'PATCH' }); if (currentUserId.current === accountId) await load(accountId); }
    catch (requestError) { if (currentUserId.current === accountId) setError(requestError.message); }
    finally { if (currentUserId.current === accountId) setBusyId(''); }
  }
  async function markAllRead() {
    const accountId = user?.id;
    if (!accountId || busyId) return;
    setBusyId('all');
    try { await apiRequest('/users/me/notifications/read-all', { method: 'POST' }); if (currentUserId.current === accountId) await load(accountId); }
    catch (requestError) { if (currentUserId.current === accountId) setError(requestError.message); }
    finally { if (currentUserId.current === accountId) setBusyId(''); }
  }

  if (!user) return null;
  return <div className="notification-center">
    <button className="notification-launcher" type="button" aria-expanded={open} aria-controls="notification-panel" onClick={() => { setOpen((value) => !value); if (!open) load(); }}>
      Notifications <span aria-label={`${unreadCount} unread`}>{ownerId === user.id ? unreadCount : 0}</span>
    </button>
    {open && <section className="notification-panel" id="notification-panel" aria-labelledby="notification-title" aria-live="polite">
      <header><div><h2 id="notification-title">Notifications</h2><p role="status">{ownerId === user.id ? unreadCount : 0} unread</p></div><button type="button" className="dashboard-secondary" disabled={!unreadCount || Boolean(busyId)} onClick={markAllRead}>Mark all read</button></header>
      {error && <p role="alert" className="dashboard-error">{error}</p>}
      {loading && <p role="status">Loading notifications…</p>}
      <ul aria-live="polite" aria-busy={loading}>{(ownerId === user.id ? notifications : []).map((item) => <li key={item.id} className={item.readAt ? 'notification-read' : 'notification-unread'}>
        <span className={`notification-severity severity-${item.severity.toLowerCase()}`}>{item.severity === 'HIGH' ? 'Urgent' : item.severity === 'WARNING' ? 'Review' : 'Information'}</span>
        <div><strong>{item.title}</strong><p>{item.message}</p><small>{new Date(item.createdAt).toLocaleString()}</small></div>
        {!item.readAt && <button type="button" className="dashboard-secondary" disabled={Boolean(busyId)} onClick={() => markRead(item.id)}>Mark read</button>}
      </li>)}</ul>
      {ownerId === user.id && !loading && !notifications.length && !error && <p>No notifications yet. Renewal and trial reminders appear here when relevant.</p>}
    </section>}
  </div>;
}
