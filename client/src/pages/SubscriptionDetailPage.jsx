import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiRequest } from '../services/apiClient.js';

const money = (amount, currency = 'INR') => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount) || 0);
const dateLabel = (date) => date ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(date)) : 'Not recorded';
const reasonLabels = { TOO_EXPENSIVE: 'Too expensive', UNUSED: 'Not used enough', DUPLICATE: 'Duplicate service', SWITCHING: 'Switching service', OTHER: 'Other' };

export function SubscriptionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState(null);
  const [requests, setRequests] = useState([]);
  const [payments, setPayments] = useState([]);
  const [historyError, setHistoryError] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState('UNUSED');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const dialogRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await apiRequest(`/users/subscriptions/${encodeURIComponent(id)}`);
      setSubscription(data.subscription);
      setHistoryError(''); setPaymentError('');
      const [history, feed] = await Promise.all([
        apiRequest(`/users/cancellation-requests?subscriptionId=${encodeURIComponent(id)}`).then((result) => ({ result })).catch((requestError) => { setHistoryError(requestError.message); return { result: { requests: [] } }; }),
        apiRequest(`/bank-feed/transactions?q=${encodeURIComponent(data.subscription.name)}&sort=date`).then((result) => ({ result })).catch((requestError) => { setPaymentError(requestError.message); return { result: { transactions: [] } }; })
      ]);
      setRequests(history.result.requests);
      setPayments((feed.result.transactions || []).filter((item) => item.merchant.toLowerCase() === data.subscription.name.toLowerCase()).slice(0, 5));
    } catch (requestError) { setError(requestError.message); setSubscription(null); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!dialogOpen) return undefined;
    const previousFocus = document.activeElement;
    dialogRef.current?.querySelector('select')?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { setDialogOpen(false); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const controls = [...dialogRef.current.querySelectorAll('button,select,textarea')].filter((item) => !item.disabled);
      if (!controls.length) return;
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previousFocus?.focus?.(); };
  }, [dialogOpen]);

  async function submitCancellation(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await apiRequest(`/users/subscriptions/${encodeURIComponent(id)}/cancellation-requests`, { method: 'POST', body: JSON.stringify({ reason, notes }) });
      setDialogOpen(false); setNotes(''); setNotice('Cancellation review recorded in this app. No external service was contacted.'); await load();
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  async function cancellationAction(requestId, action) {
    setBusy(true); setError(''); setNotice('');
    try { await apiRequest(`/users/cancellation-requests/${requestId}/${action}`, { method: 'POST' }); setNotice(action === 'restore' ? 'Subscription restored in this app.' : 'Marked cancelled in this app. Contact the provider separately for external cancellation.'); await load(); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  async function recordUse() {
    setBusy(true); setError('');
    try { await apiRequest(`/users/subscriptions/${id}/usage`, { method: 'POST' }); setNotice('Usage recorded.'); await load(); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  const latestRequest = requests[0];
  const unused = !subscription?.lastUsedAt || Date.now() - new Date(subscription.lastUsedAt).getTime() > 30 * 86400000;
  const daysToRenewal = subscription ? Math.ceil((new Date(subscription.nextRenewalDate).getTime() - Date.now()) / 86400000) : null;
  const recommendation = !subscription ? '' : subscription.status === 'CANCELLATION_REQUESTED' ? 'Review your in-app cancellation request and choose whether to mark it complete or restore the plan.' : unused ? 'Low or no usage was recorded in the last 30 days. Review whether this plan still earns its recurring cost.' : daysToRenewal >= 0 && daysToRenewal <= 7 ? 'This plan renews soon. Review its price and current value before renewal.' : 'Recent use is recorded. Keep reviewing the plan at renewal time.';

  return <main className="subscription-detail-page" id="main-content" tabIndex="-1">
    <header className="detail-header"><Link to="/personal#subscriptions">← Back to subscriptions</Link><p className="welcome-kicker">Subscription details</p><h1>{subscription?.name ?? 'Subscription'}</h1><p>Details are based on information entered in your account and simulated transaction history.</p></header>
    {loading && <p role="status">Loading subscription details…</p>}
    {error && <p role="alert" className="detail-error">{error} {error.includes('connect') && 'Reconnect to the internet and retry.'}</p>}
    {notice && <p role="status" className="detail-notice">{notice}</p>}
    {!loading && !error && subscription && <>
      <section className="detail-card detail-overview" aria-labelledby="detail-overview-title">
        <div className="detail-service-mark" aria-label="No provider logo was supplied">{subscription.name.slice(0, 1).toUpperCase()}</div>
        <div><h2 id="detail-overview-title">{subscription.name}</h2><p>{subscription.category} · {subscription.isShared ? 'Shared plan' : 'Personal plan'}{subscription.isDemoData ? ' · DEMO / SIMULATED DATA' : ''}</p><span className={`status-pill status-${subscription.status.toLowerCase()}`}>{subscription.status.replaceAll('_', ' ').toLowerCase()}</span></div>
        <div className="detail-actions">{subscription.status === 'CANCELLATION_REQUESTED' ? <span className="panel-footnote">Resolve or restore the cancellation request before editing.</span> : <Link className="dashboard-secondary detail-link" to={`/personal?edit=${encodeURIComponent(subscription.id)}#subscriptions`}>Edit subscription</Link>}<button type="button" className="dashboard-secondary" onClick={recordUse} disabled={busy || subscription.status !== 'ACTIVE'}>Mark as used</button>{subscription.status === 'ACTIVE' && <button type="button" className="dashboard-primary" onClick={() => setDialogOpen(true)}>Request cancellation review</button>}</div>
      </section>
      <section className="detail-metrics" aria-label="Subscription billing and usage">
        <article><span>Current price</span><strong>{money(subscription.amount, subscription.currency)}</strong><small>Per {subscription.billingCycle.toLowerCase()}</small></article>
        <article><span>Monthly equivalent</span><strong>{money(subscription.monthlyCost, subscription.currency)}</strong><small>Estimate from listed billing cycle</small></article>
        <article><span>Estimated yearly spend</span><strong>{money(subscription.estimatedYearlySpend ?? subscription.annualCost, subscription.currency)}</strong><small>Assumes current price continues</small></article>
        <article><span>Next renewal</span><strong>{dateLabel(subscription.nextRenewalDate)}</strong><small>{daysToRenewal >= 0 && daysToRenewal <= 7 ? `Renewal warning: ${daysToRenewal === 0 ? 'due today' : `in ${daysToRenewal} days`}` : 'Based on the date you entered'}</small></article>
        <article><span>Usage this month</span><strong>{subscription.usagePercentage ?? 0}%</strong><small>{subscription.usageCount ?? 0} uses · target {subscription.monthlyUsageTarget ?? 12}</small></article>
        <article><span>Last used</span><strong>{dateLabel(subscription.lastUsedAt)}</strong><small>Number of users: {subscription.isShared ? (subscription.memberUsage?.length || 1) : 1}</small></article>
        <article><span>Potential savings</span><strong>{unused && subscription.status === 'ACTIVE' ? `${money(subscription.monthlyCost, subscription.currency)} / mo` : 'Review at renewal'}</strong><small>Opportunity estimate only; no guaranteed savings</small></article>
        <article><span>Last payment</span><strong>{payments[0] ? money(payments[0].amount, payments[0].currency) : 'Not recorded'}</strong><small>{payments[0] ? `${dateLabel(payments[0].date)} · simulated feed` : 'No matching simulated transaction'}</small></article>
      </section>
      <section className="detail-card" aria-labelledby="detail-recommendation-title"><h2 id="detail-recommendation-title">Recommendation: {subscription.status === 'CANCELLATION_REQUESTED' ? 'Review request' : unused || (daysToRenewal >= 0 && daysToRenewal <= 7) ? 'Review plan' : 'Keep reviewing'}</h2><p>{recommendation}</p><small>Informational guidance from manually recorded usage and renewal details. You choose what to do.</small></section>
      <section className="detail-two-column"><article className="detail-card"><h2>Recent payment activity</h2>{payments.length ? <ul>{payments.map((item) => <li key={item.id}><span>{dateLabel(item.date)} · {item.isDemoData ? 'DEMO / SIMULATED DATA' : item.source === 'GENERATED' ? 'Simulated demo' : 'Simulated import'}</span><strong>{money(item.amount, item.currency)}</strong></li>)}</ul> : paymentError ? <p role="alert">Payment history could not be loaded: {paymentError}</p> : <p>No matching payments appear in the simulated transaction feed.</p>}</article>
        <article className="detail-card"><h2>Cancellation history</h2>{requests.length ? <ol>{requests.map((request) => <li key={request.id}><strong>{request.status.replaceAll('_', ' ')}</strong><span>{reasonLabels[request.reason] ?? request.reason} · {dateLabel(request.createdAt)}</span>{request.notes && <p>{request.notes}</p>}</li>)}</ol> : historyError ? <p role="alert">Cancellation history could not be loaded: {historyError}</p> : <p>No cancellation review history.</p>}{latestRequest?.status === 'REQUESTED' && <div className="detail-actions"><button type="button" disabled={busy} onClick={() => cancellationAction(latestRequest.id, 'complete')}>Mark cancelled in this app</button><button type="button" disabled={busy} onClick={() => cancellationAction(latestRequest.id, 'restore')}>Restore subscription</button></div>}{latestRequest?.status === 'COMPLETED' && <button type="button" disabled={busy} onClick={() => cancellationAction(latestRequest.id, 'restore')}>Restore subscription</button>}<p className="panel-footnote">All cancellation actions update this application's records only. Contact the provider to change an external subscription.</p></article></section>
    </>}
    {dialogOpen && subscription && <div className="dialog-backdrop"><section ref={dialogRef} className="subscription-dialog cancellation-dialog" role="dialog" aria-modal="true" aria-labelledby="cancel-dialog-title"><h2 id="cancel-dialog-title">Review cancellation for {subscription.name}</h2><dl><div><dt>Current cost</dt><dd>{money(subscription.amount, subscription.currency)} / {subscription.billingCycle.toLowerCase()}</dd></div><div><dt>Next renewal</dt><dd>{dateLabel(subscription.nextRenewalDate)}</dd></div><div><dt>Estimated yearly cost</dt><dd>{money(subscription.estimatedYearlySpend ?? subscription.annualCost, subscription.currency)}</dd></div><div><dt>Potential yearly savings</dt><dd>{money(unused ? subscription.annualCost : 0, subscription.currency)} estimated if stopped</dd></div></dl><p>This creates an in-app review record only; it does not contact or cancel the provider.</p><form onSubmit={submitCancellation}><label>Reason<select value={reason} onChange={(event) => setReason(event.target.value)}><option value="UNUSED">Not used enough</option><option value="TOO_EXPENSIVE">Too expensive</option><option value="DUPLICATE">Duplicate service</option><option value="SWITCHING">Switching service</option><option value="OTHER">Other</option></select></label><label>Notes (optional)<textarea maxLength="500" value={notes} onChange={(event) => setNotes(event.target.value)} /></label><div className="dialog-actions"><button type="button" className="dashboard-secondary" onClick={() => setDialogOpen(false)}>Keep / close</button><button className="dashboard-primary" disabled={busy}>{busy ? 'Saving…' : 'Confirm review request'}</button></div></form></section></div>}
  </main>;
}
