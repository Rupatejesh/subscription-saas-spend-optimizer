
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AccessibilityContext = createContext(null);
const DEFAULTS = { theme: 'system', highContrast: false, reducedMotion: false, fontSize: 'normal', screenReader: false, keyboard: true, captions: true, voice: 'text' };
const KEY = 'accessibility-settings';

function readSettings() {
  try { return { ...DEFAULTS, theme: localStorage.getItem('theme') || DEFAULTS.theme, voice: localStorage.getItem('bujji-voice-preference') || DEFAULTS.voice, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return DEFAULTS; }
}

export function AccessibilityProvider({ children }) {
  const [settings, setSettings] = useState(readSettings);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); localStorage.setItem('theme', settings.theme); } catch { /* Settings remain active for this visit. */ }
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => { root.dataset.theme = settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : settings.theme; };
    applyTheme();
    if (settings.theme === 'system') media.addEventListener('change', applyTheme);
    root.dataset.contrast = settings.highContrast ? 'high' : 'normal';
    root.dataset.motion = settings.reducedMotion ? 'reduced' : 'normal';
    root.dataset.fontSize = settings.fontSize;
    root.dataset.screenReader = settings.screenReader ? 'friendly' : 'standard';
    root.dataset.keyboard = settings.keyboard ? 'enhanced' : 'standard';
    return () => media.removeEventListener('change', applyTheme);
  }, [settings]);
  const value = useMemo(() => ({ settings, updateSetting: (key, value) => setSettings((current) => ({ ...current, [key]: value })) }), [settings]);
  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}

export function useAccessibility() {
  const value = useContext(AccessibilityContext);
  if (!value) throw new Error('useAccessibility must be used inside AccessibilityProvider');
  return value;
}
