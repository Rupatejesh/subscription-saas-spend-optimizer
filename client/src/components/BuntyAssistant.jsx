import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PROMPTS = [
  'Open my subscriptions',
  'Show my spending section',
  'Open the transaction feed',
  'Find reports and alerts',
  'Go to Team Admin',
  'What should I do next?'
];

export function BuntyAssistant({ role = 'USER' }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');
  const navigate = useNavigate();
  const launcherRef = useRef(null);

  useEffect(() => {
    const closeForBujji = () => setOpen(false);
    window.addEventListener('optimizer:open-bujji', closeForBujji);
    return () => window.removeEventListener('optimizer:open-bujji', closeForBujji);
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    document.getElementById('bunty-question')?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { setOpen(false); launcherRef.current?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);
  function guide(raw) {
    const prompt = raw.trim();
    if (!prompt) return;
    setQuestion('');
    const text = prompt.toLocaleLowerCase();
    const personal = role === 'USER';
    if (/subscription|plan/.test(text)) {
      navigate(personal ? '/personal#subscriptions' : '/team#subscriptions');
      setResponse(personal ? 'Your subscriptions are under My subscriptions. Search, filter, or open a plan’s details there.' : 'Team subscriptions are in Team Admin. Select your team to review shared plans.');
    } else if (/spend|spending|finance/.test(text)) {
      navigate(personal ? '/personal#spending' : '/reports');
      setResponse(personal ? 'The My spending section includes current estimates, forecasts, renewals, and recommendations.' : 'Reports & alerts includes spending summaries and team reports where available.');
    } else if (/transaction|bank feed|feed/.test(text)) {
      navigate(personal ? '/personal#bank-feed' : '/team');
      setResponse(personal ? 'The Transaction feed is labelled demo/simulated. Generate sample rows or import your own simulated CSV.' : 'The transaction feed is part of the personal workspace. Team Admin has shared-plan activity.');
    } else if (/report|alert|forecast|benchmark/.test(text)) {
      navigate('/reports');
      setResponse('Reports & alerts contains forecasts, renewal reminders, savings estimates, and simulated benchmarks.');
    } else if (/team/.test(text)) {
      navigate('/team');
      setResponse('Team Admin is where you create or select a team, invite members, and manage shared subscriptions.');
    } else if (/profile|accessibility|settings/.test(text)) {
      navigate('/profile');
      setResponse('Profile and security is available from the workspace navigation. Accessibility settings are available from the site-wide control.');
    } else {
      setResponse(personal ? 'Start with your upcoming renewals and usage notes in Personal overview, then compare estimates in Reports & alerts.' : 'Start in Team Admin to review shared subscriptions and member usage, then open Reports & alerts for summaries.');
    }
  }

  return <>
    <button ref={launcherRef} className="bunty-launcher" type="button" aria-label="Open Bunty product guide" aria-expanded={open} aria-controls="bunty-panel" onClick={() => { if (!open) window.dispatchEvent(new Event('optimizer:open-bunty')); setOpen((value) => !value); }}><span aria-hidden="true">◇</span> Bunty</button>
    {open && <section className="bunty-panel" id="bunty-panel" aria-labelledby="bunty-title">
      <header className="bunty-header"><div><h2 id="bunty-title">Bunty</h2><p>Product guide · Find your way around</p></div><button className="bunty-close" type="button" aria-label="Close Bunty" onClick={() => { setOpen(false); launcherRef.current?.focus(); }}>×</button></header>
      <div className="bunty-content">
        <p className="bunty-welcome">I can point you to a page or explain where a task lives. I won’t estimate your finances.</p>
        <div className="bunty-prompts" aria-label="Suggested navigation questions">{PROMPTS.map((prompt) => <button key={prompt} type="button" onClick={() => guide(prompt)}>{prompt}</button>)}</div>
        <form className="bunty-input-row" onSubmit={(event) => { event.preventDefault(); guide(question); }}><label className="sr-only" htmlFor="bunty-question">Ask Bunty where to go</label><input id="bunty-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask where to find something" /><button type="submit" disabled={!question.trim()}>Go</button></form>
        {response && <p className="bunty-response" role="status" aria-live="polite">{response}</p>}
      </div>
    </section>}
  </>;
}