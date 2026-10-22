import { createContext, useContext } from 'react';
import { useAccessibility } from './AccessibilityContext.jsx';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const { settings, updateSetting } = useAccessibility();
  return <ThemeContext.Provider value={{ theme: settings.theme, setTheme: (theme) => updateSetting('theme', theme) }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
