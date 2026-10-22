import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../services/apiClient.js';

export function SubscriptionIntelligence({ onUsageRecorded }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const load = useCallback(async () => {
    try { setReport(await apiRequest('/bank-feed/intelligence')); setError(''); }
    catch (requestError) { setError(requestError.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const recordUse = async (id) => {
    setBusyId(id);
    try { await apiRequest(`/users/subscriptions/${id}/usage`, { method: 'POST' }); await load(); await onUsageRecorded(); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusyId(''); }
  };

  return <section className="dashboard-panel intelligence-panel" aria-labelledby="intelligence-title">
    <div className="panel-title"><div><h2 id="intelligence-title">Subscription intelligence</h2><p>Recurring patterns and usage insights from mock data.</p></div><span className="projection-tag">SIMULATED</span></div>
    {error && <p className="dashboard-error" role="alert">{error}</p>}
    {report && <>
      <h3>Recurring payment detection</h3>
      {report.detections.length ? <ul className="intelligence-list">{report.detections.map((item) => <li key={`${item.merchant}-${item.transactionIds.join('-')}`}><div><strong>{item.merchant}</strong><small>{item.occurrenceCount} charges · {item.billingCycle.toLowerCase()} · {item.classification === 'EXISTING_SUBSCRIPTION' ? 'Matched subscription' : 'Suggested subscription'}</small><p>{item.explanation} Confidence: {Math.round(item.confidenceScore * 100)}%{item.duplicate ? ' · Possible duplicate' : ''}</p></div><span>{item.category}</span></li>)}</ul> : <p className="empty-copy">Add simulated transaction history to detect recurring payments.</p>}
      <h3>Usage and recommendations</h3>
      {report.usage.length ? <ul className="intelligence-list">{report.usage.map((item) => <li key={item.id}><div><strong>{item.name} <span className={`health-label health-${item.health.toLowerCase()}`}>{item.health.replace('_', ' ')}</span></strong><small>{item.lastUsedAt ? `Last used ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(item.lastUsedAt))}` : 'No usage recorded yet'} · {item.usageCount} uses this month · {item.usagePercentage}% of monthly target</small><p>{item.explanation} {item.recommendation}</p></div><button type="button" className="dashboard-secondary" disabled={busyId === item.id} onClick={() => recordUse(item.id)}>{busyId === item.id ? 'Recording…' : 'Record use'}</button></li>)}</ul> : <p className="empty-copy">Add a subscription to start tracking usage.</p>}
      <p className="panel-footnote">Recommendations are informational. No subscription is changed or cancelled automatically.</p>
    </>}
  </section>;
}
