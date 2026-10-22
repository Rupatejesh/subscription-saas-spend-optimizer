import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext.jsx';
import { useAccessibility } from '../context/AccessibilityContext.jsx';
import { Link } from 'react-router-dom';
import vanjangiLandscape from '../assets/vanjangi-hills.jpg';
import { SUBSCRIPTION_BRANDS, SubscriptionBrandBadge } from './SubscriptionBrand.jsx';

const story = [
  'Every small subscription looks affordable.',
  'But many small payments can become a big monthly burden.',
  'Where is your money going?',
  'Subscription & SaaS Spend Optimizer',
  'Smart Spending. Better Decisions.'
];
const INTRO_KEY = 'optimizer-cinematic-intro-v1';

function IntroCurtain({ reducedMotion, onDismiss }) {
  const skipRef = useRef(null);
  useEffect(() => {
    skipRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onDismiss();
      else if (event.key === 'Tab') { event.preventDefault(); skipRef.current?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    const timer = window.setTimeout(onDismiss, reducedMotion ? 900 : 7600);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(timer);
    };
  }, [onDismiss, reducedMotion]);

  return <div className={`cinematic-intro${reducedMotion ? ' cinematic-intro-reduced' : ''}`} role="dialog" aria-modal="true" aria-labelledby="cinematic-intro-title">
    <img className="cinematic-intro-landscape" src={vanjangiLandscape} alt="" />
    <div className="cinematic-intro-shade" />
    <div className="curtain curtain-left" aria-hidden="true" />
    <div className="curtain curtain-right" aria-hidden="true" />
    {!reducedMotion && <div className="intro-petals" aria-hidden="true">{Array.from({ length: 14 }, (_, index) => <span key={index} style={{ '--petal-index': index }} />)}</div>}
    <p className="intro-opening-line">A smarter way to understand every subscription.</p>
    <section className="intro-product-reveal">
      <p>Subscription Intelligence</p>
      <h1 id="cinematic-intro-title">SPEND OPTIMIZER</h1>
      <strong>Spend smarter. Keep what matters.</strong>
      <div className="intro-assistant-lines" aria-live="polite">
        <p><span aria-hidden="true">✦</span> Bujji <q>Hi! I’ll help you understand your subscriptions.</q></p>
        <p><span aria-hidden="true">◇</span> Bunty <q>And I’ll help you find your way around.</q></p>
      </div>
    </section>
    <button ref={skipRef} className="intro-skip" type="button" onClick={onDismiss}>Skip intro <span aria-hidden="true">↗</span></button>
  </div>;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

function ThemePicker() {
  const { theme, setTheme } = useTheme();
  return (
    <label className="theme-picker" htmlFor="theme-select">
      <span>Appearance</span>
      <select id="theme-select" value={theme} onChange={(event) => setTheme(event.target.value)}>
        <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
      </select>
    </label>
  );
}

function Landscape() {
  return (
    <div className="landscape" aria-hidden="true">
      <img className="landing-landscape-image" src={vanjangiLandscape} alt="" fetchpriority="high" />
    </div>
  );
}

function SubscriptionMarquee({ reducedMotion }) {
  const [paused, setPaused] = useState(false);
  return (
    <section className={`subscription-showcase${reducedMotion ? ' subscription-showcase-static' : ''}`} aria-labelledby="subscription-showcase-title">
      <div className="subscription-showcase-heading">
        <div>
          <p className="subscription-showcase-kicker">A clearer view of recurring costs</p>
          <h2 id="subscription-showcase-title">Subscriptions worth keeping in view</h2>
        </div>
        {!reducedMotion && <button type="button" className="marquee-toggle" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>{paused ? 'Resume motion' : 'Pause motion'}</button>}
      </div>
      <p className="sr-only">Examples include {SUBSCRIPTION_BRANDS.map((brand) => brand.name).join(', ')}. These are examples only, not connected accounts.</p>
      <div className="subscription-marquee" aria-hidden="true">
        <div className={`subscription-marquee-track${paused ? ' is-paused' : ''}`}>
          {[0, 1].map((copy) => <div className="subscription-marquee-group" key={copy} aria-hidden={copy === 1 ? true : undefined}>
            {SUBSCRIPTION_BRANDS.map((brand) => <SubscriptionBrandBadge name={brand.name} variant="marquee" key={brand.name} />)}
          </div>)}
        </div>
      </div>
      <p className="subscription-showcase-note">Examples only · No accounts are connected</p>
    </section>
  );
}

function OptimizerWelcome() {
  return (
    <section className="optimizer-welcome" aria-labelledby="welcome-title">
      <p className="welcome-kicker">Your spending, in focus</p>
      <h1 id="welcome-title">A clearer view of every subscription.</h1>
      <p>Your optimizer foundation is ready. Financial information will be clearly marked as mock or simulated unless a real integration is added.</p>
      <div className="welcome-badge"><span aria-hidden="true">✦</span> Smart Spending. Better Decisions.</div>
      <div className="welcome-auth-actions"><Link className="enter-button" to="/register">Create account <span aria-hidden="true">↗</span></Link><Link className="skip-button" to="/login">Sign in</Link></div>
    </section>
  );
}

export function CinematicLanding() {
  const landingRef = useRef(null);
  const systemReducedMotion = useReducedMotion();
  const { settings } = useAccessibility();
  const reducedMotion = systemReducedMotion || settings.reducedMotion;
  const [showIntro, setShowIntro] = useState(() => {
    try { return sessionStorage.getItem(INTRO_KEY) !== 'seen'; } catch { return true; }
  });
  const [stage, setStage] = useState(0);
  const [entered, setEntered] = useState(false);
  const isFinal = reducedMotion || stage >= story.length - 1;
  const dismissIntro = useCallback(() => {
    try { sessionStorage.setItem(INTRO_KEY, 'seen'); } catch { /* The intro still dismisses if storage is unavailable. */ }
    setShowIntro(false);
    window.requestAnimationFrame(() => landingRef.current?.focus());
  }, []);

  useEffect(() => {
    const updateInertState = () => {
      if (landingRef.current) landingRef.current.inert = showIntro;
      document.querySelectorAll('.accessibility-launcher, .connection-status, .notification-center').forEach((element) => { element.inert = showIntro; });
    };
    updateInertState();
    const observer = new MutationObserver(updateInertState);
    observer.observe(document.getElementById('root'), { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [showIntro]);

  useEffect(() => {
    if (reducedMotion || stage >= story.length - 1 || entered) return undefined;
    const timer = window.setTimeout(() => setStage((current) => Math.min(current + 1, story.length - 1)), 2200);
    return () => window.clearTimeout(timer);
  }, [entered, reducedMotion, stage]);

  return (
    <>
    <main ref={landingRef} className="cinematic-shell" id="main-content" tabIndex="-1">
      <div className="sky-art" aria-hidden="true">
        <div className="star-field star-field-one" /><div className="star-field star-field-two" />
        <span className="particle particle-one" /><span className="particle particle-two" />
        <span className="particle particle-three" /><span className="particle particle-four" />
        <span className="particle particle-five" /><span className="particle particle-six" />
      </div>
      <Landscape />
      <header className="landing-header">
        <a className="brand-mark" href="#home" aria-label="Subscription and SaaS Spend Optimizer home" onClick={(event) => { event.preventDefault(); setEntered(false); setStage(story.length - 1); }}>
          <span className="brand-symbol" aria-hidden="true">✦</span>
          <span>Spend Optimizer</span>
        </a>
        <ThemePicker />
      </header>

      {entered ? <OptimizerWelcome /> : (
        <section className={`story-panel${isFinal ? ' story-panel-final' : ''}`} aria-labelledby="story-text">
          <p className="story-overline"><span /> A little more clarity, every month</p>
          <div className="story-copy" aria-live="polite" aria-atomic="true">
            {reducedMotion ? (
              <div className="reduced-story">
                {story.map((line, index) => <p className={index === 3 ? 'story-title-line' : ''} key={line}>{line}</p>)}
              </div>
            ) : <h1 id="story-text" key={stage} className={stage === 3 ? 'story-title-line' : ''}>{story[stage]}</h1>}
          </div>
          {reducedMotion && <span className="sr-only" id="story-text">The introduction is shown without animation because reduced motion is enabled.</span>}
          <div className="story-actions">
            {isFinal ? (
              <button className="enter-button" type="button" onClick={() => setEntered(true)}>Enter Optimizer <span aria-hidden="true">↗</span></button>
            ) : (
              <button className="skip-button" type="button" onClick={() => setStage(story.length - 1)}>Skip Introduction <span aria-hidden="true">→</span></button>
            )}
          </div>
          {!isFinal && <div className="story-progress" aria-hidden="true"><span style={{ width: `${((stage + 1) / story.length) * 100}%` }} /></div>}
          <p className="demo-note">A thoughtful way to understand recurring spending</p>
        </section>
      )}
      <SubscriptionMarquee reducedMotion={reducedMotion} />
      <footer className="landing-footer"><span>Smart spending begins with awareness</span><span className="footer-dot" aria-hidden="true">✳</span><span>Designed for everyone</span><span className="landscape-credit">Landscape: <a href="https://commons.wikimedia.org/wiki/File:Vanjangi_hills_-_paderu_-_andhrapradesh_(4).jpg" target="_blank" rel="noreferrer">Muralikrishna m, Vanjangi hills near Paderu</a>, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>. Cropped with CSS.</span></footer>
    </main>
    {showIntro && <IntroCurtain reducedMotion={reducedMotion} onDismiss={dismissIntro} />}
    </>
  );
}



