import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../services/apiClient.js';

const money = (amount, currency = 'INR') => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount ?? 0);

export function TeamAdminPage() {
  const [teams, setTeams] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [insights, setInsights] = useState({ alerts: null, reports: null });
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [serviceName, setServiceName] = useState('');
  const [serviceAmount, setServiceAmount] = useState('');
  const [serviceRenewal, setServiceRenewal] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profileDescription, setProfileDescription] = useState('');

  const loadTeams = useCallback(async () => {
    setLoadingTeams(true);
    try {
      const data = await apiRequest('/teams');
      setTeams(data.teams);
      setTeamId((current) => current || data.teams[0]?.id || '');
      setError('');
    } catch (e) { setError(e.message); }
    finally { setLoadingTeams(false); }
  }, []);
  const loadDashboard = useCallback(async (id) => {
    if (!id) { setDashboard(null); return; }
    setDashboard(null); setInsights({ alerts: null, reports: null });
    setLoadingDashboard(true);
    try {
      const [data, alerts, reports] = await Promise.all([
        apiRequest(`/teams/${id}/dashboard`),
        apiRequest(`/teams/${id}/alerts`).catch((error) => ({ error: error.message })),
        apiRequest(`/teams/${id}/reports`).catch((error) => ({ error: error.message }))
      ]);
      setDashboard(data); setProfileName(data.team.name); setProfileDescription(data.team.description);
      setInsights({ alerts, reports }); setError('');
    }
    catch (e) { setError(e.message); setDashboard(null); }
    finally { setLoadingDashboard(false); }
  }, []);
  useEffect(() => { loadTeams(); apiRequest('/teams/invitations/me').then((data) => setInvitations(data.invitations)).catch(() => {}).finally(() => setLoadingInvitations(false)); }, [loadTeams]);
  useEffect(() => { loadDashboard(teamId); }, [teamId, loadDashboard]);

  async function submit(action, successMessage) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); setNotice(successMessage); await loadTeams(); if (teamId) await loadDashboard(teamId); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function createTeam(event) {
    event.preventDefault();
    await submit(async () => { const data = await apiRequest('/teams', { method: 'POST', body: JSON.stringify({ name: teamName, description: teamDescription }) }); setTeamName(''); setTeamDescription(''); setTeamId(data.team.id); }, 'Team created.');
  }
  async function updateTeamProfile(event) {
    event.preventDefault();
    await submit(() => apiRequest(`/teams/${teamId}`, { method: 'PATCH', body: JSON.stringify({ name: profileName, description: profileDescription }) }), 'Team profile updated.');
  }
  async function invite(event) {
    event.preventDefault();
    await submit(async () => { await apiRequest(`/teams/${teamId}/invitations`, { method: 'POST', body: JSON.stringify({ email: inviteEmail, role: inviteRole }) }); setInviteEmail(''); }, 'Invitation created. Share the invitation with its recipient; no email is sent by this demo.');
  }
  async function addSubscription(event) {
    event.preventDefault();
    await submit(async () => { await apiRequest(`/teams/${teamId}/subscriptions`, { method: 'POST', body: JSON.stringify({ name: serviceName, amount: Number(serviceAmount), billingCycle: 'MONTHLY', nextRenewalDate: serviceRenewal }) }); setServiceName(''); setServiceAmount(''); setServiceRenewal(''); }, 'Shared subscription added.');
  }
  async function recordUsage(subscription) {
    await submit(() => apiRequest(`/teams/${teamId}/subscriptions/${subscription._id}/usage`, { method: 'POST' }), 'Usage recorded for your account.');
  }
  async function changeRole(member, role) {
    await submit(() => apiRequest(`/teams/${teamId}/members/${member.id}`, { method: 'PATCH', body: JSON.stringify({ role }) }), 'Member role updated.');
  }
  async function removeMember(member) {
    if (!window.confirm(`Remove ${member.name} from this team?`)) return;
    await submit(() => apiRequest(`/teams/${teamId}/members/${member.id}`, { method: 'DELETE' }), 'Member removed.');
  }
  async function acceptInvitation(invitationId) {
    await submit(async () => { await apiRequest(`/teams/invitations/${invitationId}/accept`, { method: 'POST' }); await loadTeams(); setInvitations((current) => current.filter((item) => item.id !== invitationId)); }, 'Invitation accepted.');
  }

  return <main className="team-admin-page" id="main-content" tabIndex="-1">
    <header className="team-page-header"><div><Link to="/app" className="team-back-link">← Workspace</Link> <Link to="/reports" className="team-back-link">Reports & alerts</Link><p className="welcome-kicker">Team Admin</p><h1>Shared subscriptions, clearly managed</h1><p>See team costs, usage, renewals, and savings opportunities in one place.</p></div><label className="team-picker">Select team<select aria-label="Select team" value={teamId} onChange={(event) => setTeamId(event.target.value)}><option value="">Choose a team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label></header>
    {error && <p className="team-message error" role="alert">{error}</p>}{notice && <p className="team-message success" role="status">{notice}</p>}
    {loadingInvitations && <p className="team-data-note" role="status">Checking for invitations…</p>}
    {invitations.length > 0 && <section className="team-panel team-invitations"><h2>Invitations for you</h2>{invitations.map((invite) => <p key={invite.id}>{invite.team.name} · {invite.role} <button type="button" disabled={busy} onClick={() => acceptInvitation(invite.id)}>Accept invitation</button></p>)}</section>}
    {loadingTeams && <section className="team-panel" role="status" aria-live="polite">Loading your teams…</section>}
    {!loadingTeams && !teams.length && <section className="team-panel team-create-panel"><h2>Create your team</h2><p>Start a team workspace. All amounts here are entered by you and are not bank connected.</p><form onSubmit={createTeam} className="team-form"><label>Team name<input required minLength="2" maxLength="100" value={teamName} onChange={(e) => setTeamName(e.target.value)} /></label><label>Description <span>(optional)</span><input maxLength="500" value={teamDescription} onChange={(e) => setTeamDescription(e.target.value)} /></label><button disabled={busy}>Create team</button></form></section>}
    {loadingDashboard && <section className="team-panel" role="status" aria-live="polite">Loading team overview, members, subscriptions and reports…</section>}
    {dashboard && <>
      <details className="team-panel team-profile-edit"><summary>Team profile</summary><form onSubmit={updateTeamProfile} className="team-form"><label>Team name<input required minLength="2" maxLength="100" value={profileName} onChange={(event) => setProfileName(event.target.value)} /></label><label>Description<input maxLength="500" value={profileDescription} onChange={(event) => setProfileDescription(event.target.value)} /></label><button disabled={busy}>Save profile</button></form></details>
      <p className="team-data-note">MOCK / SIMULATED tracking · Usage counts are entered in this app; they are not collected from service providers.</p>
      <section className="team-metrics" aria-label="Team overview">
        <article><span>Team monthly spend</span><strong>{money(dashboard.metrics.teamMonthlySpend, dashboard.team.currency)}</strong><small>Active shared subscriptions</small></article>
        <article><span>Shared subscriptions</span><strong>{dashboard.metrics.sharedSubscriptions}</strong><small>Services currently active</small></article>
        <article><span>Unused services</span><strong>{dashboard.metrics.unusedServices}</strong><small>Low or no recent usage recorded</small></article>
        <article><span>Potential team savings</span><strong>{money(dashboard.metrics.potentialTeamSavings, dashboard.team.currency)}</strong><small>Monthly cost of unused services</small></article>
      </section>
      <section className="team-columns">
        <section className="team-panel" aria-labelledby="members-title"><div className="team-section-heading"><div><h2 id="members-title">Members & usage</h2><p>{dashboard.metrics.memberCount} team members</p></div></div>
          <ul className="team-member-list">{dashboard.memberUsage.map((member) => <li key={member.id}><div><strong>{member.name}</strong><span>{member.email}</span></div><span className="team-usage">{member.usageCount} uses</span><label className="team-role">Role<select aria-label={`Role for ${member.name}`} value={member.role} disabled={member.role === 'OWNER' || busy} onChange={(e) => changeRole(member, e.target.value)}><option value="OWNER">Owner</option><option value="ADMIN">Admin</option><option value="MEMBER">Member</option></select></label>{member.role !== 'OWNER' && <button type="button" className="quiet-button" disabled={busy} onClick={() => removeMember(member)}>Remove</button>}</li>)}</ul>
          <form onSubmit={invite} className="team-form team-inline-form"><h3>Invite a member</h3><label>Email<input type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} /></label><label>Role<select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}><option value="MEMBER">Member</option><option value="ADMIN">Admin</option></select></label><button disabled={busy}>Create invitation</button></form>
          {dashboard.pendingInvitations.length > 0 && <div className="team-pending"><h3>Pending invitations</h3>{dashboard.pendingInvitations.map((inv) => <p key={inv._id}>{inv.email} · {inv.role}</p>)}</div>}
        </section>
        <section className="team-panel" aria-labelledby="services-title"><div className="team-section-heading"><div><h2 id="services-title">Shared subscriptions</h2><p>Monthly equivalent spend by active service</p></div></div>
          <ul className="team-service-list">{dashboard.subscriptions.map((service) => <li key={service._id}><div><strong>{service.name}</strong><span>{service.usageCount} uses recorded this month · Renews {new Date(service.nextRenewalDate).toLocaleDateString()}</span><button type="button" disabled={busy} onClick={() => recordUsage(service)}>Log use</button></div><strong>{money(service.amount, service.currency)}<small> / {service.billingCycle.toLowerCase()}</small></strong></li>)}{!dashboard.subscriptions.length && <li>No shared subscriptions yet.</li>}</ul>
          <form onSubmit={addSubscription} className="team-form team-inline-form"><h3>Add shared subscription</h3><label>Service name<input required maxLength="100" value={serviceName} onChange={(e) => setServiceName(e.target.value)} /></label><label>Amount in {dashboard.team.currency}<input type="number" required min="0" step="0.01" value={serviceAmount} onChange={(e) => setServiceAmount(e.target.value)} /></label><label>Next renewal<input type="date" required value={serviceRenewal} onChange={(e) => setServiceRenewal(e.target.value)} /></label><button disabled={busy}>Add service</button></form>
        </section>
      </section>
      <section className="team-columns team-insights"><section className="team-panel"><h2>Unused services</h2>{dashboard.unusedServices.length ? <ul>{dashboard.unusedServices.map((item) => <li key={item.id}>{item.name} · {money(item.monthlySpend, dashboard.team.currency)} / month · {item.usageCount} uses recorded</li>)}</ul> : <p>No unused services identified from current usage records.</p>}</section><section className="team-panel"><h2>Renewals & alerts</h2>{dashboard.renewals.length ? <ul>{dashboard.renewals.map((item) => <li key={item.subscriptionId}>{item.name} renews {new Date(item.renewalDate).toLocaleDateString()} · {money(item.amount, item.currency)}</li>)}</ul> : <p>No renewals due in the next 30 days.</p>}</section></section>
      <section className="team-columns team-insights"><section className="team-panel"><h2>Team alerts</h2>{insights.alerts?.error ? <p role="status">Alerts could not be loaded: {insights.alerts.error}</p> : insights.alerts?.alerts?.length ? <ul className="team-alert-list">{insights.alerts.alerts.map((alert) => <li key={alert.id}><span className={`team-alert-severity ${alert.severity?.toLowerCase()}`}>{alert.severity || 'INFO'}</span><div><strong>{alert.title}</strong><p>{alert.message}</p></div></li>)}</ul> : <p>No team alerts right now.</p>}</section><section className="team-panel"><h2>Team report</h2>{insights.reports?.error ? <p role="status">Report could not be loaded: {insights.reports.error}</p> : insights.reports ? <><div className="team-report-summary"><p><span>Monthly spend</span><strong>{money(insights.reports.monthlySpend, dashboard.team.currency)}</strong></p><p><span>Annual estimate</span><strong>{money(insights.reports.annualEstimate, dashboard.team.currency)}</strong></p><p><span>Potential monthly savings</span><strong>{money(insights.reports.potentialMonthlySavings, dashboard.team.currency)}</strong></p></div><h3>Spend by category</h3>{insights.reports.categorySpending?.length ? <ul>{insights.reports.categorySpending.map((item) => <li key={item.category}>{item.category}<strong>{money(item.monthlySpend, dashboard.team.currency)}</strong></li>)}</ul> : <p>No category spend to report yet.</p>}<p className="team-report-footnote">{insights.reports.notes?.join(' ')}</p></> : <p role="status">Loading team report…</p>}</section></section>
    </>}
    {teams.length > 0 && <details className="team-panel team-create-another"><summary>Create another team</summary><form onSubmit={createTeam} className="team-form"><label>Team name<input required minLength="2" maxLength="100" value={teamName} onChange={(e) => setTeamName(e.target.value)} /></label><label>Description<input maxLength="500" value={teamDescription} onChange={(e) => setTeamDescription(e.target.value)} /></label><button disabled={busy}>Create team</button></form></details>}
  </main>;
}




