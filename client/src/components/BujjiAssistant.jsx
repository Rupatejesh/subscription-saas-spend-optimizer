import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../services/apiClient.js';
import { resolveSpeechVoice } from '../services/speechVoice.js';
import { useTheme } from '../context/ThemeContext.jsx';
import { useAccessibility } from '../context/AccessibilityContext.jsx';

const VOICES = [
  { value: 'te-female', label: 'Telugu Female Voice' },
  { value: 'te-male', label: 'Telugu Male Voice' },
  { value: 'en', label: 'English Voice' },
  { value: 'text', label: 'Text Only' }
];
const normalize = (value) => value.toLocaleLowerCase().normalize('NFC').replace(/[?!.,।]/g, '').trim();
const money = (amount, currency = 'INR') => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount) || 0);

export function BujjiAssistant({ role = 'USER' }) {
  const navigate = useNavigate();
  const { setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { settings, updateSetting } = useAccessibility();
  const voice = settings.voice;
  const [command, setCommand] = useState('');
  const [messages, setMessages] = useState([{ id: 1, who: 'Bujji', text: 'నమస్కారం! మీ subscriptions గురించి అడగండి. You can also type or use the microphone.' }]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechMessage, setSpeechMessage] = useState('');
  const [availableVoices, setAvailableVoices] = useState([]);
  const logRef = useRef(null);
  const recognitionRef = useRef(null);
  const sequence = useRef(1);
  const launcherRef = useRef(null);
  const speechSupported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const ttsSupported = typeof window !== 'undefined' && Boolean(window.speechSynthesis);

  const addMessage = (who, text) => setMessages((previous) => [...previous, { id: ++sequence.current, who, text }]);
  useEffect(() => { if (open && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [messages, open]);
  useEffect(() => {
    if (!ttsSupported) return undefined;
    const refreshVoices = () => {
      try { setAvailableVoices(window.speechSynthesis.getVoices()); }
      catch { setAvailableVoices([]); }
    };
    refreshVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
    window.speechSynthesis.onvoiceschanged = refreshVoices;
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', refreshVoices);
      if (window.speechSynthesis.onvoiceschanged === refreshVoices) window.speechSynthesis.onvoiceschanged = null;
    };
  }, [ttsSupported]);
  useEffect(() => () => { recognitionRef.current?.stop(); window.speechSynthesis?.cancel(); }, []);
  useEffect(() => {
    if (!open) return undefined;
    document.getElementById('bujji-command')?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { setOpen(false); window.speechSynthesis?.cancel(); launcherRef.current?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);
  useEffect(() => {
    const closeForGuide = () => setOpen(false);
    window.addEventListener('optimizer:open-bunty', closeForGuide);
    return () => window.removeEventListener('optimizer:open-bunty', closeForGuide);
  }, []);

  function speak(text, language = null) {
    if (!ttsSupported || voice === 'text') return;
    const resolved = resolveSpeechVoice(availableVoices, voice, language);
    if (!resolved) {
      setSpeechMessage(language === 'te' || voice.startsWith('te')
        ? 'No Telugu speech voice is available in this browser. Bujji’s text response is still available.'
        : 'No speech voice is available in this browser. Bujji’s text response is still available.');
      return;
    }
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.voice = resolved;
    utterance.lang = resolved.lang || (language === 'te' || voice.startsWith('te') ? 'te-IN' : 'en-US');
    utterance.onerror = () => setSpeechMessage('Speech playback failed. Bujji’s response remains available as text.');
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function testVoice(language) {
    if (language === 'te' && voice === 'te-female' && !availableVoices.some((item) => item.lang?.toLowerCase().startsWith('te') && /female|woman|lekha/i.test(`${item.name} ${item.voiceURI}`))) {
      setSpeechMessage('Female Telugu voice is unavailable in this browser. A Telugu voice may still be available as a fallback.');
    } else if (!availableVoices.some((item) => item.lang?.toLowerCase().startsWith(language))) {
      setSpeechMessage(`${language === 'te' ? 'Telugu' : 'English'} speech is unavailable in this browser. Bujji’s text response remains available.`);
    } else {
      setSpeechMessage(`Testing ${language === 'te' ? 'Telugu' : 'English'} speech. Voice identity depends on browser metadata; gender cannot be guaranteed.`);
    }
    speak(language === 'te' ? 'నమస్కారం. ఇది బుజ్జి తెలుగు వాయిస్ పరీక్ష.' : 'Hello. This is a Bujji voice test.', language);
  }

  async function respondTo(raw) {
    const text = raw.trim();
    if (!text || busy) return;
    addMessage('మీరు', text);
    setCommand(''); setBusy(true);
    const query = normalize(text);
    let reply = '';
    try {
      if (/dark mode|డార్క్ మోడ్/.test(query)) {
        setTheme('dark'); reply = 'Dark mode is on. డార్క్ మోడ్ ఆన్ చేశాను.';
      } else if (/light mode|లైట్ మోడ్/.test(query)) {
        setTheme('light'); reply = 'Light mode is on. లైట్ మోడ్ ఆన్ చేశాను.';
      } else if (/accessibility|అందుబాటు|సౌలభ్య/.test(query)) {
        setSettingsOpen(true); reply = 'Accessibility settings are open. ఇక్కడ మీ voice preference ఎంచుకోవచ్చు.';
      } else if (/renewal|renew|coming soon/.test(query)) {
        if (role !== 'USER') reply = 'Renewal dates are available in the workspace for your account role.';
        else {
          const summary = await apiRequest('/users/subscriptions/summary');
          const renewals = summary.upcomingRenewals || [];
          reply = renewals.length ? `Upcoming renewals in the next 30 days: ${renewals.slice(0, 5).map((item) => `${item.name} on ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(item.nextRenewalDate))}`).join('; ')}.` : 'There are no renewals due in the next 30 days.';
        }
      } else if (/alert|reminder/.test(query)) {
        const data = await apiRequest('/users/me/alerts');
        const alerts = data.alerts || [];
        reply = alerts.length ? `You have ${alerts.length} current alert${alerts.length === 1 ? '' : 's'}. ${alerts.slice(0, 3).map((item) => item.title).join('; ')}.` : 'There are no current alerts.';
      } else if (/report|forecast|benchmark/.test(query)) {
        if (role !== 'USER') reply = 'Reports and forecasts are available from Reports & alerts in your workspace.';
        else {
          const report = await apiRequest('/users/me/reports');
          const totals = report.totals || [];
          reply = totals.length ? `Your report summarizes ${totals.map((item) => `${money(item.monthlySpend, item.currency)} per month in ${item.currency}`).join(' and ')} across active plans. It also includes renewals, usage, savings estimates, a six-month forecast, and simulated benchmarks. Open Reports & alerts for the detail.` : 'Your report has no active plan spending yet. Add a subscription to see estimates, then open Reports & alerts for forecasts and benchmarks.';
        }
      } else if (/trial/.test(query)) {
        const data = await apiRequest('/users/me/trial');
        const trial = data.trial;
        reply = trial.status === 'TRIAL_NOT_STARTED' ? 'Your simulated 30-day application trial has not started. You can start it from the trial banner in your workspace.' : trial.status === 'TRIAL_EXPIRED' ? 'Your simulated application trial has ended. No payment method is connected and no charge will be made.' : `Your simulated application trial has ${trial.daysRemaining} days remaining. No payment method is connected and no charge will be made.`;
      } else if (/show.*subscription|subscriptions.*show|subscriptions చూపించు|నా subscriptions/.test(query)) {
        if (role !== 'USER') reply = 'Subscription details are available in the personal workspace for your account role.';
        else {
          const data = await apiRequest('/users/subscriptions');
          const items = data.subscriptions || [];
          reply = items.length ? `You have ${items.length} subscriptions: ${items.map((item) => item.name).join(', ')}.` : 'You have no subscriptions yet.';
        }
      } else if (/how much|spend|ఖర్చు|ఎంత ఖర్చు/.test(query)) {
        if (role !== 'USER') reply = 'Monthly subscription totals are available in the personal workspace for your account role.';
        else {
          const summary = await apiRequest('/users/subscriptions/summary');
          reply = `Your current monthly subscription estimate is ${money(summary.monthlySpend, summary.currency)}. This is a recurring cost estimate, not transaction history.`;
        }
      } else if (/unused|review|వాడని|ఉపయోగించని/.test(query)) {
        if (role !== 'USER') reply = 'Unused subscription details are available in the personal workspace for your account role.';
        else {
          const data = await apiRequest('/users/subscriptions');
          const items = (data.subscriptions || []).filter((item) => item.status === 'ACTIVE' && (!item.lastUsedAt || (Date.now() - new Date(item.lastUsedAt).getTime()) > 30 * 86400000));
          reply = items.length ? `These active subscriptions have no use recorded in the last 30 days: ${items.map((item) => item.name).join(', ')}.` : 'No unused active subscriptions were found based on recorded use.';
        }
      } else if (/details|detail|వివరాలు|చెప్పు/.test(query)) {
        if (role !== 'USER') reply = 'Subscription details are available in the personal workspace for your account role.';
        else {
          const data = await apiRequest('/users/subscriptions');
          const item = (data.subscriptions || []).find((subscription) => query.includes(normalize(subscription.name)) || normalize(subscription.name).includes(query.replace(/details|detail|వివరాలు|చెప్పు/g, '').trim()));
          reply = item ? `${item.name}: ${money(item.amount, item.currency)} per ${item.billingCycle.toLowerCase()}, status ${item.status.toLowerCase()}, next renewal ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(item.nextRenewalDate))}.` : 'I could not match that service name. Try its exact name, such as “Netflix details”.';
        }
      } else if (/save|saving|డబ్బు save|ఎక్కడ.*డబ్బు/.test(query)) {
        if (role !== 'USER') reply = 'Savings suggestions are available in the personal workspace for your account role.';
        else {
          const summary = await apiRequest('/users/subscriptions/summary');
          reply = `Your dashboard estimates ${money(summary.potentialSavings, summary.currency)} in monthly costs for unused plans. Check the “Spend smarter” section to review details before making changes.`;
        }
      } else if (/go to subscriptions|open subscriptions/.test(query)) {
        navigate('/personal#subscriptions'); reply = 'Opening your subscriptions list.';
      } else reply = 'I can explain monthly spend, subscriptions to review, upcoming renewals, alerts, savings, reports, and trial status. I can also change theme or open accessibility settings.';
    } catch (error) { reply = `I could not load that information. ${error.message || 'Please try again.'}`; }
    addMessage('Bujji', reply); speak(reply); setBusy(false);
  }

  function startListening() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { setSpeechMessage('Speech recognition is not supported in this browser. Type your command instead.'); return; }
    const recognition = new Recognition(); recognitionRef.current = recognition;
    const selected = availableVoices.find((item) => item.voiceURI === voice);
    recognition.lang = voice.startsWith('te') || selected?.lang?.toLowerCase().startsWith('te') ? 'te-IN' : 'en-US'; recognition.interimResults = false; recognition.maxAlternatives = 1;
    recognition.onstart = () => { setListening(true); setSpeechMessage('Listening…'); };
    recognition.onresult = (event) => { const result = event.results[0][0].transcript; setSpeechMessage(`Heard: ${result}`); respondTo(result); };
    recognition.onerror = (event) => setSpeechMessage(`Speech input error (${event.error}). You can type instead.`);
    recognition.onend = () => setListening(false);
    recognition.start();
  }

  function chooseVoice(value) { updateSetting('voice', value); }

  return <>
    <button ref={launcherRef} className="bujji-launcher" type="button" aria-label="Open Bujji financial assistant" aria-expanded={open} aria-controls="bujji-panel" onClick={() => { if (!open) window.dispatchEvent(new Event('optimizer:open-bujji')); setOpen(!open); }}><span aria-hidden="true">✦</span> Bujji</button>
    {open && <section className="bujji-panel" id="bujji-panel" aria-labelledby="bujji-title">
      <header className="bujji-header"><div><h2 id="bujji-title">Bujji</h2><p>Financial intelligence · Telugu and English</p></div><button type="button" className="bujji-icon-button" onClick={() => { setOpen(false); launcherRef.current?.focus(); }} aria-label="Close Bujji">×</button></header>
      <div className="bujji-log" ref={logRef} role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation with Bujji">
        {messages.map((message) => <article className={`bujji-message ${message.who === 'Bujji' ? 'bujji-message-assistant' : ''}`} key={message.id}><strong>{message.who}</strong><p>{message.text}</p></article>)}
      </div>
      <div className="bujji-suggestions" aria-label="Suggested questions">
        <button type="button" onClick={() => respondTo('How much am I spending every month?')}>Monthly spending</button><button type="button" onClick={() => respondTo('Which subscriptions should I review?')}>Subscriptions to review</button><button type="button" onClick={() => respondTo('What renewals are coming soon?')}>Upcoming renewals</button><button type="button" onClick={() => respondTo('Where can I save money?')}>Savings opportunities</button><button type="button" onClick={() => respondTo('Explain my spending report.')}>Explain my report</button>
      </div>
      <form className="bujji-input-row" onSubmit={(event) => { event.preventDefault(); respondTo(command); }}><label className="sr-only" htmlFor="bujji-command">Type a command for Bujji</label><input id="bujji-command" value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Type in English or Telugu" /><button type="submit" disabled={busy || !command.trim()}>Send</button></form>
      <div className="bujji-controls"><button type="button" onClick={startListening} disabled={!speechSupported || listening} aria-label="Start voice input">{listening ? 'Listening…' : '🎙 Speak'}</button><button type="button" onClick={() => { setSettingsOpen(!settingsOpen); setSpeechMessage(''); }}>Accessibility settings</button></div>
      <p className="bujji-status" role="status">{speechMessage || (speechSupported ? 'Voice input available in supported browsers.' : 'Voice input unavailable; text commands work here.')}</p>
      {settingsOpen && <section className="bujji-settings" aria-labelledby="bujji-settings-title"><h3 id="bujji-settings-title">Voice preference</h3><label htmlFor="bujji-voice">Choose speech output</label><select id="bujji-voice" value={availableVoices.some((item) => item.voiceURI === voice) ? voice : voice} onChange={(event) => chooseVoice(event.target.value)}><option value="text">Text only</option>{VOICES.filter((item) => item.value !== 'text' && item.value !== 'te-male' && item.value !== 'te-female').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}<option value="te-female">Telugu voice (female metadata if available)</option><option value="te-male">Telugu voice (fallback choice)</option>{availableVoices.map((item) => <option key={item.voiceURI} value={item.voiceURI}>{item.name} ({item.lang})</option>)}</select><p>Installed browser voices are listed above. Gender labels use voice metadata where present and cannot guarantee a person’s gender. {!availableVoices.some((item) => item.lang?.toLowerCase().startsWith('te') && /female|woman|lekha/i.test(`${item.name} ${item.voiceURI}`)) && <span> Female Telugu voice is unavailable in this browser.</span>} {ttsSupported ? '' : 'Speech output is unavailable; responses remain visible as text.'} Transcript remains available in the conversation.</p><div className="bujji-controls"><button type="button" disabled={!ttsSupported || voice === 'text'} onClick={() => testVoice('te')}>Test Telugu voice</button><button type="button" disabled={!ttsSupported || voice === 'text'} onClick={() => testVoice('en')}>Test English voice</button><button type="button" disabled={!ttsSupported} onClick={() => { window.speechSynthesis.cancel(); setSpeechMessage('Speech stopped. Bujji’s text responses remain available.'); }}>Stop speech</button></div></section>}
    </section>}
  </>;
}
