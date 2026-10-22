import { useEffect, useState } from 'react';
import { apiRequest } from '../services/apiClient.js';

export function TrialStatus() {
  const [trial, setTrial] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    try { const data = await apiRequest('/users/me/trial'); setTrial(data.trial); setError(''); }
    catch (requestError) { setError(requestError.message); }
  }
  useEffect(() => { load(); }, []);
  async function start() {
    setBusy(true); setError('');
    try { const data = await apiRequest('/users/me/trial/start', { method: 'POST' }); setTrial(data.trial); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  if (!trial && !error) return <p className="trial-banner" role="status">Loading application trial…</p>;
  if (error) return <p className="trial-banner trial-error" role="alert">Trial information is unavailable: {error}</p>;
  return <section className={`trial-banner ${trial.status === 'TRIAL_EXPIRED' ? 'trial-expired' : ''}`} aria-label="Application trial status">
    <div><strong>{trial.status === 'TRIAL_NOT_STARTED' ? '30-Day Free Trial' : trial.status === 'TRIAL_EXPIRED' ? 'Application trial ended' : `${trial.daysRemaining} days left in your 30-Day Free Trial`}</strong>
      <p>Simulated billing environment. This is an application trial; no payment method is connected and no charge will be made.</p>
      {trial.endsAt && <small>Trial end date: {new Date(trial.endsAt).toLocaleDateString()}</small>}
    </div>
    {trial.status === 'TRIAL_NOT_STARTED' && <button type="button" className="dashboard-primary" disabled={busy} onClick={start}>{busy ? 'Starting…' : 'Start trial'}</button>}
  </section>;
}
