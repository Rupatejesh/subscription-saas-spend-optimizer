import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../services/apiClient.js';

const money = (amount, currency = 'INR') => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount ?? 0);
const dayLabel = (date) => new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));
const alertLabel = (type) => ({ RENEWAL: 'Renewal', UNUSED: 'Unused plan', SPENDING: 'Spending', SAVINGS: 'Savings', TEAM_RENEWAL: 'Team renewal', TEAM_UNUSED: 'Team usage', TEAM_SPENDING: 'Team spending', TEAM_SAVINGS: 'Team savings' }[type] ?? 'Alert');

export function ReportsPage() {
  const [report, setReport] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [benchmarks, setBenchmarks] = useState(null);
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [teamReport, setTeamReport] = useState(null);
  const [teamAlerts, setTeamAlerts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadTeam = useCallback(async (id) => {
    if (!id) { setTeamReport(null); setTeamAlerts([]); return; }
    try {
      const [reportData, alertData] = await Promise.all([apiRequest(`/teams/${id}/reports`), apiRequest(`/teams/${id}/alerts`)]);
      setTeamReport(reportData); setTeamAlerts(alertData.alerts); setError('');
    } catch (e) { setError(e.message); setTeamReport(null); setTeamAlerts([]); }
  }, []);
  useEffect(() => {
    Promise.all([apiRequest('/users/me/reports'), apiRequest('/users/me/alerts'), apiRequest('/users/me/benchmarks'), apiRequest('/teams')])
      .then(([reportData, alertData, benchmarkData, teamData]) => { setReport(reportData); setAlerts(alertData.alerts); setBenchmarks(benchmarkData); setTeams(teamData.teams); setTeamId(teamData.teams[0]?.id ?? ''); })
      .catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadTeam(teamId); }, [teamId, loadTeam]);

  return <main className="reports-page" id="main-content" tabIndex="-1">
    <header className="reports-header"><div><Link to="/app" className="reports-back">← Workspace</Link><p className="welcome-kicker">Reports & insights</p><h1>Understand your recurring spend</h1><p>Reports use subscription plans and usage you entered. Forecasts are estimates, not transaction history.</p></div>{teams.length > 0 && <label className="reports-team-picker">Team report<select value={teamId} onChange={(event) => setTeamId(event.target.value)} aria-label="Choose team report"><option value="">Personal only</option>{teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select></label>}</header>
    {error && <p className="reports-error" role="alert">{error}</p>}{loading && <p role="status">Loading reports…</p>}
    {alerts.length > 0 && <section className="reports-section" aria-labelledby="alerts-title"><div className="reports-section-heading"><div><h2 id="alerts-title">Your alerts</h2><p>Renewal, usage, spending, and savings reminders</p></div><span>{alerts.length}</span></div><ul className="reports-alert-list">{alerts.map((alert) => <li key={alert.id}><span className={`report-alert-type alert-${alert.severity.toLowerCase()}`}>{alertLabel(alert.type)}</span><div><strong>{alert.title}</strong><p>{alert.message}</p>{alert.dueAt && <small>Due {dayLabel(alert.dueAt)}</small>}</div></li>)}</ul></section>}
    {report && <>
      <section className="reports-section" aria-labelledby="spend-title"><div className="reports-section-heading"><div><h2 id="spend-title">Spending report</h2><p>Current active plans · Annual figures project today’s recurring prices for 12 months</p></div><span>MOCK / SIMULATED</span></div>
        <div className="report-total-grid">{report.totals.map((total) => <article key={total.currency}><span>{total.currency} monthly spend</span><strong>{money(total.monthlySpend, total.currency)}</strong><small>Annual estimate {money(total.annualEstimate, total.currency)} · Possible monthly savings {money(total.potentialMonthlySavings, total.currency)}</small></article>)}{!report.totals.length && <p>No active plan spending to report.</p>}</div>
        <div className="reports-table-wrap"><table><caption>Monthly and annual estimates by category and currency</caption><thead><tr><th scope="col">Currency</th><th scope="col">Category</th><th scope="col">Monthly spend</th><th scope="col">Annual estimate</th></tr></thead><tbody>{report.categorySpending.map((item) => <tr key={`${item.currency}-${item.category}`}><td>{item.currency}</td><th scope="row">{item.category}</th><td>{money(item.monthlySpend, item.currency)}</td><td>{money(item.annualEstimate, item.currency)}</td></tr>)}{!report.categorySpending.length && <tr><td colSpan="4">No active category spending.</td></tr>}</tbody></table></div>
      </section>
      <section className="reports-two-column">
        <article className="reports-section"><h2>Subscription usage</h2><p>Manually logged use for {report.period}</p><ul className="reports-plain-list">{report.subscriptionUsage.map((item) => <li key={item.id}><span><strong>{item.name}</strong><small>{item.category} · {item.status.toLowerCase()}</small></span><b>{item.usageCount} uses</b></li>)}{!report.subscriptionUsage.length && <li>No subscriptions recorded.</li>}</ul></article>
        <article className="reports-section"><h2>Renewals</h2><p>Active plans due in the next 90 days</p><ul className="reports-plain-list">{report.renewals.map((item) => <li key={item.id}><span><strong>{item.name}</strong><small>{dayLabel(item.dueAt)} · {item.daysUntil} days</small></span><b>{money(item.amount, item.currency)}</b></li>)}{!report.renewals.length && <li>No renewals due in the next 90 days.</li>}</ul></article>
      </section>
      <section className="reports-section"><h2>Six-month forecast</h2><p>Assumes the current active plans continue at their current price.</p><div className="report-forecast-grid">{report.forecast.map((group) => <div key={group.currency}><h3>{group.currency}</h3><ul>{group.months.map((month) => <li key={month.month}><span>{month.month}</span><strong>{money(month.amount, group.currency)}</strong></li>)}</ul></div>)}</div></section>
      <section className="reports-section"><h2>Potential savings</h2><p>Monthly cost of plans with no use recorded in the last 30 days.</p><ul className="reports-plain-list">{report.savings.map((item) => <li key={item.subscriptionId}><span><strong>{item.name}</strong><small>{item.category}</small></span><b>{money(item.monthlyAmount, item.currency)} / month</b></li>)}{!report.savings.length && <li>No unused active plans identified.</li>}</ul></section>
    </>}
    {benchmarks && <section className="reports-section" aria-labelledby="benchmark-title"><div className="reports-section-heading"><div><h2 id="benchmark-title">Peer benchmark</h2><p>Compare your INR category estimates with fixed simulated reference averages.</p></div><span>DEMO AGGREGATES</span></div><p className="benchmark-privacy">No other users’ subscription records or personal information are used in this comparison.</p><ul className="benchmark-list">{benchmarks.comparisons.map((item) => <li key={item.category}><div><strong>{item.category}</strong><p>{item.message}</p></div><span>{money(item.monthlySpend, item.currency)} <small>you</small></span><span>{money(item.demoAverage, item.currency)} <small>demo average</small></span></li>)}{!benchmarks.comparisons.length && <li>Add an active INR plan to see category comparisons.</li>}</ul></section>}
    {teamReport && <>
      <section className="reports-section" aria-labelledby="team-report-title"><div className="reports-section-heading"><div><h2 id="team-report-title">{teamReport.team.name} team report</h2><p>Shared subscription and manually logged team usage</p></div><span>MOCK / SIMULATED</span></div><div className="report-total-grid"><article><span>Monthly team spend</span><strong>{money(teamReport.monthlySpend, teamReport.team.currency)}</strong><small>Annual estimate {money(teamReport.annualEstimate, teamReport.team.currency)}</small></article><article><span>Potential monthly savings</span><strong>{money(teamReport.potentialMonthlySavings, teamReport.team.currency)}</strong><small>Low-usage shared plans</small></article></div><div className="reports-table-wrap"><table><caption>Team monthly spend by category</caption><thead><tr><th scope="col">Category</th><th scope="col">Monthly spend</th></tr></thead><tbody>{teamReport.categorySpending.map((item) => <tr key={item.category}><th scope="row">{item.category}</th><td>{money(item.monthlySpend, teamReport.team.currency)}</td></tr>)}</tbody></table></div></section>
      <section className="reports-two-column"><article className="reports-section"><h2>Team usage</h2><ul className="reports-plain-list">{teamReport.subscriptionUsage.map((item) => <li key={item.id}><span><strong>{item.name}</strong><small>{item.category}</small></span><b>{item.usesThisMonth} uses</b></li>)}</ul></article><article className="reports-section"><h2>Team alerts</h2><ul className="reports-plain-list">{teamAlerts.map((alert) => <li key={alert.id}><span><strong>{alert.title}</strong><small>{alert.message}</small></span><b>{alertLabel(alert.type)}</b></li>)}{!teamAlerts.length && <li>No team alerts at this time.</li>}</ul></article></section>
      <section className="reports-section"><h2>Team forecast</h2><p>Recurring prices projected forward; this is not transaction history.</p><ul className="reports-plain-list">{teamReport.forecast.map((item) => <li key={item.month}><span>{item.month}</span><b>{money(item.amount, item.currency)}</b></li>)}</ul></section>
    </>}
  </main>;
}
