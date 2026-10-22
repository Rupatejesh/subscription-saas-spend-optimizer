import { useEffect, useRef, useState } from 'react';
import { useAccessibility } from '../context/AccessibilityContext.jsx';

export function AccessibilitySettings() {
  const [open, setOpen] = useState(false);
  const launcherRef = useRef(null);
  const { settings, updateSetting } = useAccessibility();
  const select = (key, label, options) => <label className="accessibility-field" htmlFor={`accessibility-${key}`} key={key}>{label}<select id={`accessibility-${key}`} value={settings[key]} onChange={(event) => updateSetting(key, event.target.value)}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
  const checkbox = (key, label) => <label className="accessibility-toggle" key={key}><input type="checkbox" checked={settings[key]} onChange={(event) => updateSetting(key, event.target.checked)} /><span>{label}</span></label>;
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { setOpen(false); launcherRef.current?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return <>
    <button ref={launcherRef} className="accessibility-launcher" type="button" aria-expanded={open} aria-controls="accessibility-panel" onClick={() => setOpen((value) => !value)}>Accessibility settings</button>
    {open && <section id="accessibility-panel" className="accessibility-panel" aria-labelledby="accessibility-title">
      <div className="accessibility-heading"><h2 id="accessibility-title">Accessibility settings</h2><button type="button" className="accessibility-close" onClick={() => { setOpen(false); launcherRef.current?.focus(); }} aria-label="Close accessibility settings">Close</button></div>
      {select('theme', 'Color theme', [['system', 'Use device setting'], ['light', 'Light mode'], ['dark', 'Dark mode']])}
      {checkbox('highContrast', 'High contrast')}
      {checkbox('reducedMotion', 'Reduced motion')}
      {select('fontSize', 'Font size', [['normal', 'Standard'], ['large', 'Large'], ['larger', 'Extra large']])}
      {checkbox('screenReader', 'Screen reader friendly mode')}
      {checkbox('keyboard', 'Keyboard navigation enhancements')}
      {checkbox('captions', 'Show captions and transcripts')}
      <label className="accessibility-field" htmlFor="accessibility-voice">Voice preference<select id="accessibility-voice" value={settings.voice} onChange={(event) => updateSetting('voice', event.target.value)}>{settings.voice && !['text', 'en', 'te-female', 'te-male'].includes(settings.voice) && <option value={settings.voice}>Current installed voice (change in Bujji)</option>}<option value="text">Text only</option><option value="en">English voice (first available)</option><option value="te-female">Telugu voice (female metadata when available)</option><option value="te-male">Telugu voice (fallback choice)</option></select></label>
      <p className="accessibility-note">Keyboard navigation and visible focus stay available. Bujji responses are shown as text; speech depends on voices installed in your browser. Choose an installed voice and test Telugu or English in Bujji settings.</p>
    </section>}
  </>;
}
