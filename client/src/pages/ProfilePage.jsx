import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../services/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { TrialStatus } from '../components/TrialStatus.jsx';

const PREFERENCE_LABELS = { renewals: 'Renewal reminders', unused: 'Unused subscription alerts', savings: 'Potential savings alerts', spending: 'Spending alerts', team: 'Team and account alerts', trial: 'Application trial reminders' };

export function ProfilePage() {
  const { user, refreshSession, signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user.name);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [preferences, setPreferences] = useState(null);
  const [preferenceError, setPreferenceError] = useState('');
  const [preferenceNotice, setPreferenceNotice] = useState('');
  const [preferenceBusy, setPreferenceBusy] = useState(false);

  useEffect(() => { apiRequest('/users/me/notification-preferences').then((data) => setPreferences(data.preferences)).catch((error) => setPreferenceError(error.message)); }, []);
  async function changePreference(key, value) {
    setPreferenceBusy(true); setPreferenceError(''); setPreferenceNotice('');
    try {
      const data = await apiRequest('/users/me/notification-preferences', { method: 'PUT', body: JSON.stringify({ preferences: { [key]: value } }) });
      setPreferences(data.preferences); setPreferenceNotice('Notification preferences saved.');
    } catch (error) { setPreferenceError(error.message); }
    finally { setPreferenceBusy(false); }
  }

  async function submit(event) {
    event.preventDefault(); setError(''); setMessage('');
    if (name.trim().length < 2 || name.trim().length > 80) { setError('Name must be between 2 and 80 characters.'); return; }
    setBusy(true);
    try { await apiRequest('/users/me', { method: 'PUT', body: JSON.stringify({ name: name.trim() }) }); await refreshSession(); setMessage('Profile updated.'); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  async function changePassword(event) {
    event.preventDefault(); setPasswordError(''); setPasswordMessage('');
    if (passwords.newPassword.length < 12 || passwords.newPassword.length > 128) { setPasswordError('New password must be between 12 and 128 characters.'); return; }
    if (passwords.newPassword !== passwords.confirmPassword) { setPasswordError('New password and confirmation do not match.'); return; }
    setBusy(true);
    try {
      const result = await apiRequest('/users/me/password', { method: 'PATCH', body: JSON.stringify(passwords) });
      setPasswordMessage(result?.message ?? 'Password changed. Sign in again to continue.');
      await signOut();
      navigate('/login', { replace: true });
    } catch (requestError) { setPasswordError(requestError.message); }
    finally { setBusy(false); }
  }

  return <main className="auth-page profile-page" id="main-content" tabIndex="-1"><section className="auth-card profile-card" aria-labelledby="profile-title">
    <Link className="auth-brand" to="/app">← <span>Back to workspace</span></Link>
    <p className="welcome-kicker">Account settings</p><h1 id="profile-title">Your profile</h1><p className="profile-intro">Manage your account details, security and the reminders you receive.</p>
    <TrialStatus />
    <form onSubmit={submit} noValidate>
      <div className="form-field"><label htmlFor="profile-name">Full name</label><input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></div>
      <div className="form-field"><label htmlFor="profile-email">Email address</label><input id="profile-email" value={user.email} readOnly /></div>
      <div className="form-field"><label htmlFor="profile-role">Account role</label><input id="profile-role" value={user.role.replaceAll('_', ' ')} readOnly /></div>
      {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}
      <button className="auth-submit" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
    </form>
    <hr className="auth-divider" />
    <section className="notification-preferences" aria-labelledby="notification-preferences-title"><h2 id="notification-preferences-title">Notification preferences</h2><p>Choose which reminders this account receives.</p>
      {preferenceError && <p role="alert" className="form-error">{preferenceError}</p>}{preferenceNotice && <p role="status" className="form-success">{preferenceNotice}</p>}
      {preferences ? Object.entries(PREFERENCE_LABELS).map(([key, label]) => <label className="preference-toggle" key={key}><input type="checkbox" checked={Boolean(preferences[key])} disabled={preferenceBusy} onChange={(event) => changePreference(key, event.target.checked)} /><span>{label}</span></label>) : !preferenceError && <p role="status">Loading preferences…</p>}
    </section>
    <hr className="auth-divider" />
    <h2 className="security-heading">Change password</h2>
    <form onSubmit={changePassword} noValidate>
      <div className="form-field"><label htmlFor="current-password">Current password</label><input id="current-password" type="password" autoComplete="current-password" value={passwords.currentPassword} onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} required /></div>
      <div className="form-field"><label htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" value={passwords.newPassword} onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })} aria-describedby="new-password-hint" required /><span className="field-hint" id="new-password-hint">Use 12–128 characters.</span></div>
      <div className="form-field"><label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" type="password" autoComplete="new-password" value={passwords.confirmPassword} onChange={(event) => setPasswords({ ...passwords, confirmPassword: event.target.value })} required /></div>
      {passwordError && <p className="form-error" role="alert">{passwordError}</p>}{passwordMessage && <p className="form-success" role="status">{passwordMessage}</p>}
      <button className="auth-submit" disabled={busy}>{busy ? 'Updating…' : 'Change password'}</button>
    </form>
  </section></main>;
}
