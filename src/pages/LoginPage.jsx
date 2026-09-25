import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.js';

// Full-screen sign-in for the POS. Any route under /pos redirects here
// while no user is logged in, and already-signed-in users get bounced
// straight back to the dashboard.
export default function LoginPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (currentUser) {
    return <Navigate to="/pos" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const user = await login({ username, password });
      if (user) {
        // Managers land on the admin dashboard; cashiers go straight to checkout.
        navigate(user.role === 'manager' ? '/admin' : '/pos', { replace: true });
      } else {
        setError('Invalid username or password.');
        setPassword('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="content-card login-card p-3 md:p-4">
        <div className="login-brand">
          <img
            src="/assets/images/maison-logo-mark.png"
            alt="Maison de Luxe"
            className="login-brand-mark brand-logo-img"
          />
          <div className="text-center">
            <div className="login-brand-name">Maison de Luxe</div>
            <div className="login-brand-sub">Point of Sale</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-2">
            <label className="field-label" htmlFor="loginUsername">
              Username
            </label>
            <input
              id="loginUsername"
              type="text"
              className="field-control"
              autoComplete="username"
              placeholder="e.g. cashier"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="mb-3">
            <label className="field-label" htmlFor="loginPassword">
              Password
            </label>
            <input
              id="loginPassword"
              type="password"
              className="field-control"
              autoComplete="current-password"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error ? <div className="form-error mb-2">{error}</div> : null}

          <button type="submit" className="place-order-btn w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="login-credentials mt-3">
          <strong>Demo accounts</strong>
          <div>
            <span>Cashier</span> <code>cashier</code> / <code>123456</code>
          </div>
          <div>
            <span>Manager</span> <code>manager</code> / <code>admin123</code>
          </div>
        </div>

        <Link to="/" className="login-back-link">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}