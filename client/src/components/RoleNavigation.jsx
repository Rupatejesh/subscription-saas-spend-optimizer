import { Link, useLocation } from 'react-router-dom';

const navigationIcons = { 'Personal overview': '◫', 'My subscriptions': '▤', 'My spending': '↗', 'Transaction feed (demo)': '⇄', 'Team Admin': '⌂', 'Reports & alerts': '◷', 'Team overview': '⌂', 'Team subscriptions': '▤', 'Team members': '♧', 'Platform overview': '◈', 'User accounts': '♙', Teams: '♧', 'Platform controls': '⚙' };

const navigationByRole = {
  USER: [
    { label: 'Personal overview', to: '/personal' },
    { label: 'My subscriptions', to: '/personal#subscriptions' },
    { label: 'My spending', to: '/personal#spending' },
    { label: 'Transaction feed (demo)', to: '/personal#bank-feed' },
    { label: 'Team Admin', to: '/team' },
    { label: 'Reports & alerts', to: '/reports' }
  ],
  TEAM_ADMIN: [
    { label: 'Team overview', to: '/team' },
    { label: 'Team subscriptions', to: '/team#subscriptions' },
    { label: 'Team members', to: '/team#members' },
    { label: 'Reports & alerts', to: '/reports' }
  ],
  PLATFORM_ADMIN: [
    { label: 'Platform overview', to: '/platform' },
    { label: 'User accounts', to: '/platform#users' },
    { label: 'Teams', to: '/platform#teams' },
    { label: 'Platform controls', to: '/platform#controls' },
    { label: 'Reports & alerts', to: '/reports' }
  ]
};

export function RoleNavigation({ role }) {
  const location = useLocation();
  const links = navigationByRole[role] ?? [];
  const isCurrent = (to) => {
    const [pathname, hash = ''] = to.split('#');
    return location.pathname === pathname && location.hash === (hash ? '#' + hash : '');
  };
  return <nav className="workspace-nav" aria-label={role.replaceAll('_', ' ').toLowerCase() + ' navigation'}>
    {links.map((item) => {
      const current = isCurrent(item.to);
      return <Link key={item.label} to={item.to} className={current ? 'active' : undefined} aria-current={current ? (location.hash ? 'location' : 'page') : undefined}><span className="workspace-nav-icon" aria-hidden="true">{navigationIcons[item.label]}</span><span>{item.label}</span></Link>;
    })}
  </nav>;
}
