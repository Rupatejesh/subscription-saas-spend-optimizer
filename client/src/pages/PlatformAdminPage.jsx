import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../services/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { RoleNavigation } from '../components/RoleNavigation.jsx';
import { TrialStatus } from '../components/TrialStatus.jsx';
import { BujjiAssistant } from '../components/BujjiAssistant.jsx';

const money = (amount, currency) => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount ?? 0);

export function PlatformAdminPage() {
  const { user, signOut } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    try {
      const [metricData, userData, teamData] = await Promise.all([apiRequest('/admin/metrics'), apiRequest('/admin/users?page=1&limit=50'), apiRequest('/admin/teams')]);
      setMetrics(metricData); setUsers(userData.users); setTeams(teamData.teams); setError('');
    } catch (requestError) { setError(requestError.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  async function updateRole(account, role) {
    setBusy(account.id); setNotice(''); setError('');
    try {
      await apiRequest(`/users/${account.id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
      setNotice(`Role updated for ${account.name}. Their existing session was invalidated.`); await load();
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(''); }
  }

  return <main className="workspace-page platform-admin-page" id="main-content" tabIndex="-1">
    <header className="workspace-header"><Link className="auth-brand" to="/">✦ <span>Spend Optimizer</span></Link><div className="workspace-account"><span>{user.name} <small>PLATFORM ADMIN</small></span><button type="button" onClick={signOut}>Sign out</button></div></header>
    <div className="workspace-layout"><aside><RoleNavigation role="PLATFORM_ADMIN" /><Link className="profile-link" to="/profile">Profile and security</Link></aside>
      <section className="workspace-content admin-content" aria-labelledby="platform-title"><TrialStatus /><p className="welcome-kicker">Restricted platform workspace</p><h1 id="platform-title">Platform administration</h1><p>Account and simulated product metrics. Financial totals are estimates from user-entered subscriptions.</p>
        {error && <p role="alert" className="dashboard-error">{error}</p>}{notice && <p role="status" className="dashboard-notice">{notice}</p>}
        {metrics ? <>
          <div className="admin-metric-grid" aria-label="Platform metrics"><article><span>Total accounts</span><strong>{metrics.users.total}</strong></article><article><span>Active application trials</span><strong>{metrics.users.activeTrials}</strong></article><article><span>Expired trials</span><strong>{metrics.users.expiredTrials}</strong></article><article><span>Teams</span><strong>{metrics.teams.total}</strong></article><article><span>Active subscriptions</span><strong>{metrics.subscriptions.active}</strong></article><article><span>Cancellation reviews</span><strong>{metrics.subscriptions.cancellationRequested}</strong></article><article><span>Cancelled in app</span><strong>{metrics.subscriptions.cancelled}</strong></article><article><span>Database status</span><strong>{metrics.system.database === 'connected' ? 'Connected' : 'Unavailable'}</strong></article></div>
          <section className="admin-panel"><h2>Simulated recurring spend</h2><p>Monthly equivalents based on active plans. No bank feed is connected.</p>{metrics.simulatedSpend.length ? <ul>{metrics.simulatedSpend.map((item) => <li key={item.currency}><span>{item.currency}</span><strong>{money(item.monthly, item.currency)} / month</strong><small>Potential review amount {money(item.potentialMonthlySavings, item.currency)} / month</small></li>)}</ul> : <p>No active subscription records.</p>}</section>
          <section className="admin-panel"><h2>Accounts</h2><p>Showing up to 50 accounts. Passwords, session tokens, and credentials are never returned.</p><div className="admin-user-list">{users.map((account) => <article key={account.id}><div><strong>{account.name}</strong><span>{account.email}</span><small>{account.id === user.id ? 'Your current administrator account' : 'Role access changes require a new sign-in'}</small></div><label>Role<select aria-label={`Role for ${account.name}`} value={account.role} disabled={busy === account.id || account.id === user.id} onChange={(event) => updateRole(account, event.target.value)}><option value="USER">User</option><option value="TEAM_ADMIN">Team Admin</option><option value="PLATFORM_ADMIN">Platform Admin</option></select></label></article>)}</div></section>
          <section className="admin-panel"><h2>Teams</h2><p>Read-only overview of team membership and shared simulated spend.</p>{teams.length ? <ul className="admin-team-list">{teams.map((team) => <li key={team.id}><div><strong>{team.name}</strong><span>{team.memberCount} members · {team.activeSharedSubscriptions} active shared plans</span></div><strong>{money(team.monthlySpend, team.currency)} / month</strong></li>)}</ul> : <p>No teams have been created.</p>}</section>
          <section className="admin-panel"><h2>Recent important activity</h2>{metrics.recentActivity.length ? <ol className="admin-activity-list">{metrics.recentActivity.map((event) => <li key={event.id}><strong>{event.summary}</strong><span>{event.action.replaceAll('_', ' ')} · {event.actor?.name ?? 'System'} · {new Date(event.createdAt).toLocaleString()}</span></li>)}</ol> : <p>No administrative or cancellation activity has been recorded.</p>}</section>
          <p className="admin-system-note">System status is based on the current database connection. Only supported account role changes are available here; no unrestricted database controls are exposed.</p>
        </> : !error && <p role="status">Loading platform metrics…</p>}
      </section>
    </div><BujjiAssistant role="PLATFORM_ADMIN" />
  </main>;
}
