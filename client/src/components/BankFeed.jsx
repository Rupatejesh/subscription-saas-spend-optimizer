import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../services/apiClient.js';

const categories = ['Entertainment', 'Productivity', 'Cloud Storage', 'Design', 'AI Tools', 'Utilities', 'Other'];
const sampleCsv = 'merchant,amount,date,currency,category,recurring\nNetflix,649,2026-09-01,INR,Entertainment,true\nSpotify,119,2026-09-04,INR,Entertainment,true';
const money = (value, currency) => new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'INR' }).format(value);
const date = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));

export function BankFeed() {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ q: '', category: '', recurring: '' });
  const [csv, setCsv] = useState(sampleCsv);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
      const result = await apiRequest(`/bank-feed/transactions?${params}`);
      setItems(result.transactions);
    } catch (err) { setError(err.message); }
  }, [filters]);
  useEffect(() => { load(); const refresh = () => load(); window.addEventListener('optimizer:data-refresh', refresh); return () => window.removeEventListener('optimizer:data-refresh', refresh); }, [load]);
  const action = async (path, options, message) => {
    setBusy(true); setError(''); setNotice('');
    try { const result = await apiRequest(path, options); setNotice(`${message}${result.count ? ` (${result.count})` : ''}`); await load(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const generate = () => action('/bank-feed/transactions/generate', { method: 'POST' }, 'Simulated demo transactions generated.');
  const importCsv = () => action('/bank-feed/transactions/import', { method: 'POST', body: JSON.stringify({ csv }) }, 'CSV parsed and imported as simulated data.');
  const categorize = (id, category) => action(`/bank-feed/transactions/${id}/category`, { method: 'PATCH', body: JSON.stringify({ category }) }, 'Category updated.');

  return <section className="dashboard-panel bank-feed-panel" id="bank-feed" aria-labelledby="bank-feed-title">
    <div className="bank-feed-heading"><div><span className="demo-label">DEMO / SIMULATED BANK DATA</span><h2 id="bank-feed-title">Transaction feed</h2><p>Sample subscription charges for exploring transaction search, categories, and recurring detection.</p></div>
      <button className="dashboard-primary" type="button" disabled={busy} onClick={generate}>Generate demo transactions</button></div>
    {notice && <p role="status" className="dashboard-notice">{notice}</p>}{error && <p role="alert" className="dashboard-error">{error}</p>}
    <div className="bank-import"><label className="dashboard-field">Simulated CSV import<textarea rows="3" value={csv} onChange={(event) => setCsv(event.target.value)} aria-describedby="bank-import-help" /></label><div><p id="bank-import-help" className="panel-footnote">No bank connection or credentials. Columns: merchant, amount, date; optional currency, category, recurring. Import saves only the provided demo rows.</p><button type="button" className="dashboard-secondary" disabled={busy} onClick={importCsv}>Parse and import CSV</button></div></div>
    <div className="subscription-filters bank-filters" role="search" aria-label="Filter simulated transactions">
      <label className="search-control"><span className="sr-only">Search merchant</span><input type="search" placeholder="Search merchant" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} /></label>
      <label><span className="sr-only">Filter transaction category</span><select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span className="sr-only">Recurring payment filter</span><select value={filters.recurring} onChange={(event) => setFilters({ ...filters, recurring: event.target.value })}><option value="">All payments</option><option value="true">Possible recurring</option><option value="false">Not marked recurring</option></select></label>
    </div>
    {items.length ? <div className="transaction-list" aria-live="polite">{items.map((item) => <article className="transaction-row" key={item.id}>
      <div><strong>{item.merchant}</strong><small>{date(item.date)} · {item.isDemoData ? 'DEMO / SIMULATED DATA' : item.source === 'SIMULATED_IMPORT' ? 'Simulated CSV import' : 'Generated demo'}</small></div>
      <strong>{money(item.amount, item.currency)}</strong>
      <label><span className="sr-only">Category for {item.merchant}</span><select value={item.category} onChange={(event) => categorize(item.id, event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <span className="recurring-pill">{item.possibleRecurring ? 'Possible recurring' : 'One-time'}</span><span className="confidence">{Math.round(item.confidenceScore * 100)}% confidence</span>
    </article>)}</div> : <p className="empty-copy">No matching transactions. Generate demo data or change your filters.</p>}
  </section>;
}
