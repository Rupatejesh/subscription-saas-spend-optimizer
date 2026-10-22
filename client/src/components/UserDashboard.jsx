import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../services/apiClient.js';
import { BankFeed } from './BankFeed.jsx';
import { SubscriptionIntelligence } from './SubscriptionIntelligence.jsx';
import { SpendSmarter } from './SpendSmarter.jsx';
import { SUBSCRIPTION_BRANDS, SubscriptionBrandMonogram } from './SubscriptionBrand.jsx';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

const CATEGORIES = ['Entertainment', 'Productivity', 'Cloud Storage', 'Design', 'AI Tools', 'Utilities', 'Other'];
const EMPTY = { name: '', category: 'Other', amount: '', currency: 'INR', billingCycle: 'MONTHLY', nextRenewalDate: '', status: 'ACTIVE', lastUsedAt: '', notes: '' };
const money = (amount, currency = 'INR') => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount ?? 0);
const dateLabel = (value) => new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));

export function UserDashboard() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [subscriptions, setSubscriptions] = useState([]);
  const [forecastSubscriptions, setForecastSubscriptions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filters, setFilters] = useState({ q: '', category: '', status: '', sort: 'renewal', order: 'asc' });
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dialogRef = useRef(null);
  const [demoBusy, setDemoBusy] = useState(false);

  useEffect(() => {
    const targetId = location.hash.slice(1);
    if (!targetId) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return undefined;
    }
    let finalTimer;
    const frame = window.requestAnimationFrame(() => {
      finalTimer = window.setTimeout(() => {
        document.getElementById(targetId)?.scrollIntoView({ block: 'start', behavior: 'auto' });
      }, 100);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (finalTimer) window.clearTimeout(finalTimer);
    };
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!dialogOpen) return undefined;
    const previousFocus = document.activeElement;
    dialogRef.current?.querySelector('input')?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') { setDialogOpen(false); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll('button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])')].filter((element) => !element.disabled);
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); previousFocus?.focus?.(); };
  }, [dialogOpen]);

  const load = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
      const [list, metrics, allSubscriptions] = await Promise.all([
        apiRequest(`/users/subscriptions?${params}`),
        apiRequest('/users/subscriptions/summary'),
        apiRequest('/users/subscriptions')
      ]);
      setSubscriptions(list.subscriptions);
      setSummary(metrics);
      setForecastSubscriptions(allSubscriptions.subscriptions);
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => {
    load();
    window.addEventListener('online', load);
    return () => window.removeEventListener('online', load);
  }, [load]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setError(''); setDialogOpen(true); };
  const openEdit = (item) => {
    setEditing(item.id);
    setForm({ name: item.name, category: item.category, amount: String(item.amount), currency: item.currency, billingCycle: item.billingCycle, nextRenewalDate: item.nextRenewalDate.slice(0, 10), status: item.status, lastUsedAt: item.lastUsedAt ? item.lastUsedAt.slice(0, 10) : '', notes: item.notes ?? '' });
    setError(''); setDialogOpen(true);
  };
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId || !forecastSubscriptions.length) return;
    const item = forecastSubscriptions.find((subscription) => subscription.id === editId);
    if (item) openEdit(item);
    setSearchParams({}, { replace: true });
  }, [forecastSubscriptions, searchParams, setSearchParams]);
  async function toggleDemoWorkspace() {
    const loaded = forecastSubscriptions.some((item) => item.isDemoData);
    const prompt = loaded ? 'Remove only the clearly labelled demo subscriptions? Your personal subscriptions will remain.' : 'Add 12 clearly labelled demo subscriptions alongside your existing account data?';
    if (!window.confirm(prompt)) return;
    setDemoBusy(true); setError(''); setNotice('');
    try {
      const result = await apiRequest('/users/demo-workspace', { method: loaded ? 'DELETE' : 'POST' });
      setNotice(result.message ?? (loaded ? 'Demo data removed.' : 'Demo data loaded.'));
      window.dispatchEvent(new Event('optimizer:data-refresh'));
      await load();
    } catch (requestError) { setError(requestError.message); }
    finally { setDemoBusy(false); }
  }
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    const payload = { ...form, amount: Number(form.amount), nextRenewalDate: new Date(`${form.nextRenewalDate}T12:00:00`).toISOString(), lastUsedAt: form.lastUsedAt ? new Date(`${form.lastUsedAt}T12:00:00`).toISOString() : null };
    try {
      await apiRequest(editing ? `/users/subscriptions/${editing}` : '/users/subscriptions', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setDialogOpen(false); setNotice(editing ? 'Subscription updated.' : 'Subscription added.'); await load();
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };
  const remove = async (item) => {
    if (!window.confirm(`Delete ${item.name}? This cannot be undone.`)) return;
    setError('');
    try { await apiRequest(`/users/subscriptions/${item.id}`, { method: 'DELETE' }); setNotice(`${item.name} deleted.`); await load(); }
    catch (requestError) { setError(requestError.message); }
  };
  const trendMax = useMemo(() => Math.max(1, ...(summary?.spendingTrend ?? []).map((point) => point.amount)), [summary]);

  return <div className="user-dashboard">
    <div className="dashboard-heading">
      <div><p className="welcome-kicker">Your money, in focus</p><h1 id="workspace-title">Personal overview</h1><p>Manage recurring plans and spot opportunities to save.</p></div>
      <button className="dashboard-primary" type="button" onClick={openCreate}>+ Add subscription</button>
    </div>

    <section className="dashboard-brand-strip" aria-label="Subscription service examples"><div><strong>Services worth keeping in view</strong><p>Examples only · No provider accounts are connected.</p></div><div className="dashboard-brand-list">{SUBSCRIPTION_BRANDS.slice(0, 6).map((brand) => <span className="dashboard-brand-item" key={brand.name}><SubscriptionBrandMonogram name={brand.name} /><span>{brand.name}</span></span>)}</div></section>

    <section className="demo-workspace-control" aria-label="Demo data controls"><div><strong>Demo Workspace</strong><p>Load or remove sample subscriptions marked DEMO / SIMULATED DATA. Existing personal plans are preserved.</p></div><button type="button" className="dashboard-secondary" disabled={demoBusy} onClick={toggleDemoWorkspace}>{demoBusy ? 'Working...' : forecastSubscriptions.some((item) => item.isDemoData) ? 'Remove Demo Workspace' : 'Load Demo Workspace'}</button></section>
    {notice && <p className="dashboard-notice" role="status">{notice}</p>}
    {error && !dialogOpen && <p className="dashboard-error" role="alert">{error}</p>}

    <section className="metric-grid" aria-label="Subscription summary">
      <article className="metric-card metric-featured"><span>Total monthly spend</span><strong>{summary ? money(summary.monthlySpend, summary.currency) : '—'}</strong><small>Annual estimate {summary ? money(summary.annualSpend, summary.currency) : '—'}</small></article>
      <article className="metric-card"><span>Active subscriptions</span><strong>{summary?.activeCount ?? '—'}</strong><small>Recurring plans</small></article>
      <article className="metric-card"><span>Unused subscriptions</span><strong>{summary?.unusedCount ?? '—'}</strong><small>Not used in the last 30 days</small></article>
      <article className="metric-card"><span>Upcoming renewals</span><strong>{summary?.upcomingRenewalCount ?? '—'}</strong><small>Next 30 days</small></article>
      <article className="metric-card"><span>Potential savings</span><strong>{summary ? money(summary.potentialSavings, summary.currency) : '—'}</strong><small>Monthly cost of unused plans</small></article>
      <article className="metric-card health-card"><span>Subscription health</span><strong>{summary ? `${summary.healthScore}%` : '—'}</strong><small>Based on recent use</small><div className="health-track" role="progressbar" aria-label="Subscription health score" aria-valuemin="0" aria-valuemax="100" aria-valuenow={summary?.healthScore ?? 0}><span style={{ width: `${summary?.healthScore ?? 0}%` }} /></div></article>
    </section>

    <SpendSmarter subscriptions={forecastSubscriptions} currency={summary?.currency ?? 'INR'} />

    <section className="dashboard-insights" aria-label="Spending and renewals">
      <article className="dashboard-panel trend-panel"><div className="panel-title"><div><h2>Spending trend</h2><p>Monthly plan cost projection</p></div><span className="projection-tag">ESTIMATE</span></div>
        <div className="trend-chart" role="img" aria-label={`Projected recurring monthly spend: ${summary ? money(summary.monthlySpend, summary.currency) : 'loading'}.`}>
          {(summary?.spendingTrend ?? []).map((point) => <div className="trend-column" key={point.month}><strong>{money(point.amount, summary?.currency)}</strong><span className="trend-bar" style={{ height: `${Math.max(6, point.amount / trendMax * 100)}%` }} /><small>{point.month}</small></div>)}
        </div>
        <p className="panel-footnote">Projection assumes current active plans continue. It is not transaction history.</p>
      </article>
      <article className="dashboard-panel renewal-panel"><div className="panel-title"><div><h2>Upcoming renewals</h2><p>Due within 30 days</p></div><span className="renewal-count">{summary?.upcomingRenewalCount ?? 0}</span></div>
        {summary?.upcomingRenewals?.length ? <ul className="renewal-list">{summary.upcomingRenewals.map((item) => <li key={item.id}><span><strong>{item.name}</strong><small>{dateLabel(item.nextRenewalDate)}</small></span><b>{money(item.amount, item.currency)}</b></li>)}</ul> : <p className="empty-copy">No renewals due in the next 30 days.</p>}
      </article>
    </section>

    <section className="dashboard-panel subscriptions-panel" id="subscriptions" aria-labelledby="subscriptions-title">
      <div className="subscription-section-heading"><div><h2 id="subscriptions-title">Your subscriptions</h2><p>Search, filter, and update your recurring plans.</p></div><span>{subscriptions.length} shown</span></div>
      <div className="subscription-filters" role="search" aria-label="Filter subscriptions">
        <label className="search-control"><span className="sr-only">Search by service name</span><input type="search" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="Search subscriptions" /></label>
        <label><span className="sr-only">Filter by category</span><select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">All categories</option>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label><span className="sr-only">Filter by status</span><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="PAUSED">Paused</option><option value="CANCELLED">Cancelled</option></select></label>
        <label><span className="sr-only">Sort subscriptions</span><select value={`${filters.sort}:${filters.order}`} onChange={(event) => { const [sort, order] = event.target.value.split(':'); setFilters({ ...filters, sort, order }); }}><option value="renewal:asc">Renewal date · soonest</option><option value="renewal:desc">Renewal date · latest</option><option value="amount:desc">Amount · highest</option><option value="amount:asc">Amount · lowest</option><option value="name:asc">Name · A to Z</option><option value="name:desc">Name · Z to A</option></select></label>
      </div>
      {loading ? <p className="empty-copy" role="status">Loading subscriptions...</p> : subscriptions.length ? <div className="subscription-list">{subscriptions.map((item) => <article className="subscription-row" key={item.id}>
        <div className="subscription-mark"><SubscriptionBrandMonogram name={item.name} /></div><div className="subscription-info"><strong>{item.name}</strong>{item.isDemoData && <span className="demo-tag">DEMO / SIMULATED DATA</span>}<span>{item.category} · {item.billingCycle.toLowerCase()}</span></div>
        <div className="subscription-price"><strong>{money(item.amount, item.currency)}</strong><span>per {item.billingCycle.toLowerCase()}</span></div>
        <div className="subscription-renewal"><span className={`status-pill status-${item.status.toLowerCase()}`}>{item.status.toLowerCase()}</span><small>Renews {dateLabel(item.nextRenewalDate)}</small></div>
        <div className="subscription-actions"><Link to={`/subscriptions/${item.id}`} aria-label={`View details for ${item.name}`}>Details</Link><button type="button" onClick={() => openEdit(item)} aria-label={`Edit ${item.name}`}>Edit</button><button type="button" className="delete-action" onClick={() => remove(item)} aria-label={`Delete ${item.name}`}>Delete</button></div>
      </article>)}</div> : <div className="empty-state"><span aria-hidden="true">✳</span><h3>{filters.q || filters.category || filters.status ? 'No matching subscriptions' : 'Your list is ready when you are'}</h3><p>{filters.q || filters.category || filters.status ? 'Try changing or clearing your filters.' : 'Add a subscription to see renewal dates and spending summaries here.'}</p>{!filters.q && !filters.category && !filters.status && <button type="button" className="dashboard-primary" onClick={openCreate}>Add your first subscription</button>}</div>}
    </section>

    <SubscriptionIntelligence onUsageRecorded={load} />
    <BankFeed />

    {dialogOpen && <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialogOpen(false); }}><section ref={dialogRef} className="subscription-dialog" role="dialog" aria-modal="true" aria-labelledby="subscription-form-title">
      <div className="dialog-heading"><div><p className="welcome-kicker">Subscription details</p><h2 id="subscription-form-title">{editing ? 'Edit subscription' : 'Add subscription'}</h2></div><button type="button" className="dialog-close" onClick={() => setDialogOpen(false)} aria-label="Close form">×</button></div>
      {error && <p className="dashboard-error" role="alert">{error}</p>}
      <form onSubmit={submit}>
        <label className="dashboard-field">Service name<input autoFocus required maxLength="100" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <div className="form-grid"><label className="dashboard-field">Amount<input required type="number" min="0" max="1000000" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label><label className="dashboard-field">Currency<input required maxLength="3" pattern="[A-Za-z]{3}" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} /></label></div>
        <div className="form-grid"><label className="dashboard-field">Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><label className="dashboard-field">Billing cycle<select value={form.billingCycle} onChange={(event) => setForm({ ...form, billingCycle: event.target.value })}><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option><option value="YEARLY">Yearly</option></select></label></div>
        <div className="form-grid"><label className="dashboard-field">Next renewal date<input required type="date" value={form.nextRenewalDate} onChange={(event) => setForm({ ...form, nextRenewalDate: event.target.value })} /></label><label className="dashboard-field">Last used date<input type="date" value={form.lastUsedAt} onChange={(event) => setForm({ ...form, lastUsedAt: event.target.value })} /></label></div>
        <div className="form-grid"><label className="dashboard-field">Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="ACTIVE">Active</option><option value="PAUSED">Paused</option><option value="CANCELLED">Cancelled</option></select></label><label className="dashboard-field">Notes<input maxLength="500" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label></div>
        <div className="dialog-actions"><button type="button" className="dashboard-secondary" onClick={() => setDialogOpen(false)}>Cancel</button><button className="dashboard-primary" type="submit" disabled={busy}>{busy ? 'Saving...' : editing ? 'Save changes' : 'Add subscription'}</button></div>
      </form>
    </section></div>}
  </div>;
}

