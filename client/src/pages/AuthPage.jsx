import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/app" replace />;

  function update(event) {
    setValues((previous) => ({ ...previous, [event.target.name]: event.target.value }));
    setFieldErrors((previous) => ({ ...previous, [event.target.name]: '' }));
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    const errors = {};
    if (isRegister && values.name.trim().length < 2) errors.name = 'Enter your name (at least 2 characters).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Enter a valid email address.';
    if (isRegister && (values.password.length < 12 || values.password.length > 128)) errors.password = 'Use 12 to 128 characters for your password.';
    if (!isRegister && !values.password) errors.password = 'Enter your password.';
    if (Object.keys(errors).length) { setFieldErrors(errors); return; }
    setBusy(true);
    try {
      if (isRegister) await signUp({ name: values.name.trim(), email: values.email.trim(), password: values.password });
      else await signIn({ email: values.email.trim(), password: values.password });
      navigate(location.state?.from || '/app', { replace: true });
    } catch (requestError) {
      if (requestError.details) setFieldErrors(requestError.details);
      setError(requestError.message || 'We could not complete that request. Please try again.');
    } finally { setBusy(false); }
  }

  return <main className="auth-page" id="main-content" tabIndex="-1">
    <section className="auth-card" aria-labelledby="auth-title">
      <Link className="auth-brand" to="/">✦ <span>Spend Optimizer</span></Link>
      <p className="welcome-kicker">Secure account access</p>
      <h1 id="auth-title">{isRegister ? 'Create your account' : 'Welcome back'}</h1>
      <p className="auth-intro">{isRegister ? 'Start with a personal account. An administrator can assign team roles when needed.' : 'Sign in to continue to your role-based workspace.'}</p>
      <form onSubmit={submit} noValidate>
        {isRegister && <div className="form-field"><label htmlFor="name">Full name</label><input id="name" name="name" autoComplete="name" value={values.name} onChange={update} required aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? 'name-error' : undefined} />{fieldErrors.name && <span className="field-error" id="name-error">{fieldErrors.name}</span>}</div>}
        <div className="form-field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" inputMode="email" value={values.email} onChange={update} required aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'email-error' : undefined} />{fieldErrors.email && <span className="field-error" id="email-error">{fieldErrors.email}</span>}</div>
        <div className="form-field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} value={values.password} onChange={update} required aria-describedby={fieldErrors.password ? 'password-error' : isRegister ? 'password-hint' : undefined} aria-invalid={Boolean(fieldErrors.password)} />{isRegister && <span className="field-hint" id="password-hint">Use 12–128 characters.</span>}{fieldErrors.password && <span className="field-error" id="password-error">{fieldErrors.password}</span>}</div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}</button>
      </form>
      <p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to Spend Optimizer?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</Link></p>
      <Link className="back-home" to="/">Back to introduction</Link>
    </section>
  </main>;
}
