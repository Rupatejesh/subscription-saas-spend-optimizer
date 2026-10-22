import { useAuth } from '../context/AuthContext.jsx';
import { RoleNavigation } from '../components/RoleNavigation.jsx';
import { UserDashboard } from '../components/UserDashboard.jsx';
import { BujjiAssistant } from '../components/BujjiAssistant.jsx';
import { BuntyAssistant } from '../components/BuntyAssistant.jsx';
import { TrialStatus } from '../components/TrialStatus.jsx';
import { Navigate } from 'react-router-dom';

const roleCopy = {
  USER: { title: 'Your personal workspace', description: 'Personal subscriptions and spending tools will appear here as their product phases are built.' },
  TEAM_ADMIN: { title: 'Team workspace', description: 'Team subscription and member tools will appear here as their product phases are built.' },
  PLATFORM_ADMIN: { title: 'Platform administration', description: 'Platform management tools will appear here as their product phases are built.' }
};

export function WorkspacePage() {
  const { user, signOut } = useAuth();
  if (user.role === 'PLATFORM_ADMIN') return <Navigate to="/platform" replace />;
  const copy = roleCopy[user.role] ?? roleCopy.USER;
  return <main className="workspace-page" id="main-content" tabIndex="-1">
    <header className="workspace-header">
      <a className="auth-brand" href="/">✦ <span>Spend Optimizer</span></a>
      <div className="workspace-account"><span>{user.name} <small>{user.role.replaceAll('_', ' ')}</small></span><button type="button" onClick={signOut}>Sign out</button></div>
    </header>
    <TrialStatus />
    <div className="workspace-layout">
      <aside><RoleNavigation role={user.role} /><a className="profile-link" href="/profile">Profile and security</a></aside>
      {user.role === 'USER' ? <section className="workspace-content user-workspace-content" aria-labelledby="workspace-title"><UserDashboard /></section> : <section className="workspace-content" aria-labelledby="workspace-title">
        <p className="welcome-kicker">Access controlled by your account role</p>
        <h1 id="workspace-title">{copy.title}</h1>
        <p>{copy.description}</p>
        <div className="role-badge">Signed in as <strong>{user.role.replaceAll('_', ' ')}</strong></div>
      </section>}
    </div>
    <BujjiAssistant role={user.role} />
    <BuntyAssistant role={user.role} />
  </main>;
}
