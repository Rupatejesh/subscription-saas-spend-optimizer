import { ThemeProvider } from './ThemeContext.jsx';
import { AuthProvider } from './AuthContext.jsx';
import { AccessibilityProvider } from './AccessibilityContext.jsx';
import { AccessibilitySettings } from '../components/AccessibilitySettings.jsx';
import { ConnectionStatus } from '../components/ConnectionStatus.jsx';
import { NotificationCenter } from '../components/NotificationCenter.jsx';

export function AppProviders({ children }) {
  return <AccessibilityProvider><ThemeProvider><a className="skip-link" href="#main-content">Skip to main content</a><AuthProvider>{children}<AccessibilitySettings /><ConnectionStatus /><NotificationCenter /></AuthProvider></ThemeProvider></AccessibilityProvider>;
}
