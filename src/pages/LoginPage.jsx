import { useState, useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.js';
import { useEmployeeStore } from '../stores/employeeStore.js';
import { isSupabaseConfigured } from '../lib/supabase.js';

// Full-screen sign-in for the POS. Any route under /pos redirects here
// while no user is logged in, and already-signed-in users get bounced
// straight back to the dashboard.
export default function LoginPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const login = useAuthStore((s) => s.login);
  const getActiveCashiers = useEmployeeStore((s) => s.getActiveCashiers);
  const navigate = useNavigate();

  const [mode, setMode] = useState('cashier'); // 'cashier' | 'manager'
  const [cashierName, setCashierName] = useState('');
  const [pin, setPin] = useState('');
  const [managerUser, setManagerUser] = useState('');
  const [managerPass, setManagerPass] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const cashiers = getActiveCashiers();

  if (currentUser) {
    return <Navigate to="/pos" replace />;
  }

  // Reset form when mode changes
  useEffect(() => {
    setError('');
    setPin('');
    setManagerPass('');
  }, [mode]);

  const handleCashierSubmit = async (e) => {
    e.preventDefault();
    if (!cashierName || !pin) return;
    setSubmitting(true);
    setError('');
    try {
      const user = await login({ username: cashierName, password: pin });
      if (user) {
        navigate('/pos', { replace: true });
      } else {
        setError('Invalid cashier name or PIN.');
        setPin('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleManagerSubmit = async (e) => {
    e.preventDefault();
    if (!managerUser || !managerPass) return;
    setSubmitting(true);
    setError('');
    try {
      const user = await login({ username: managerUser, password: managerPass });
      if (user) {
        navigate(user.role === 'manager' ? '/admin' : '/pos', { replace: true });
      } else {
        setError('Invalid username or password.');
        setManagerPass('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePinClick = (digit) => {
    if (pin.length < 4) {
      setPin((p) => p + digit);
    }
  };

  const handlePinBackspace = () => {
    setPin((p) => p.slice(0, -1));
  };

  const handlePinClear = () => {
    setPin('');
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

        {/* Role toggle */}
        <div className="flex gap-2 mb-3" role="tablist" aria-label="Login as">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'cashier'}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              mode === 'cashier'
                ? 'bg-accent text-accent-ink'
                : 'bg-surface-border/50 text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setMode('cashier')}
          >
            Cashier
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'manager'}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              mode === 'manager'
                ? 'bg-accent text-accent-ink'
                : 'bg-surface-border/50 text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setMode('manager')}
          >
            Manager
          </button>
        </div>

        {mode === 'cashier' ? (
          <form onSubmit={handleCashierSubmit}>
            <div className="mb-2">
              <label className="field-label" htmlFor="cashierSelect">
                Select Cashier
              </label>
              <select
                id="cashierSelect"
                className="field-control"
                value={cashierName}
                onChange={(e) => setCashierName(e.target.value)}
                required
                disabled={cashiers.length === 0}
              >
                <option value="">Choose a cashier…</option>
                {cashiers.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              {cashiers.length === 0 && (
                <p className="text-muted text-xs mt-1">
                  No active cashiers. Manager must add one in Settings → Staff Management.
                </p>
              )}
            </div>

            <div className="mb-2">
              <label className="field-label">PIN (4 digits)</label>
              <div className="flex gap-2 mb-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="flex-1 h-12 border rounded-lg bg-bg-elevated flex items-center justify-center text-2xl font-mono font-bold"
                    style={{ borderColor: pin.length >= i ? 'var(--accent)' : 'var(--surface-border)' }}
                  >
                    {pin[i - 1] ? '●' : <span className="text-muted">−</span>}
                  </div>
                ))}
              </div>
              <div className="pin-pad grid grid-cols-3 gap-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="h-12 rounded-lg bg-surface-border/50 hover:bg-surface-border/80 text-text-primary font-bold text-lg touch-manipulation"
                    onClick={() => handlePinClick(d)}
                    disabled={pin.length >= 4 || submitting}
                  >
                    {d}
                  </button>
                ))}
                <button
                  type="button"
                  className="h-12 rounded-lg bg-surface-border/50 hover:bg-surface-border/80 text-text-primary font-bold text-lg touch-manipulation"
                  onClick={handlePinClear}
                  disabled={pin.length === 0 || submitting}
                >
                  C
                </button>
                <button
                  type="button"
                  className="h-12 rounded-lg bg-surface-border/50 hover:bg-surface-border/80 text-text-primary font-bold text-lg touch-manipulation"
                  onClick={handlePinBackspace}
                  disabled={pin.length === 0 || submitting}
                >
                  ⌫
                </button>
                <button
                  type="button"
                  className="h-12 rounded-lg bg-surface-border/50 hover:bg-surface-border/80 text-text-primary font-bold text-lg touch-manipulation"
                  onClick={() => handlePinClick(0)}
                  disabled={pin.length >= 4 || submitting}
                >
                  0
                </button>
              </div>
            </div>

            {error ? <div className="form-error mb-2">{error}</div> : null}

            <button type="submit" className="place-order-btn w-full" disabled={submitting || !cashierName || pin.length !== 4 || cashiers.length === 0}>
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleManagerSubmit}>
            <div className="mb-2">
              <label className="field-label" htmlFor="loginUsername">
                Username
              </label>
              <input
                id="loginUsername"
                type="text"
                className="field-control"
                autoComplete="username"
                placeholder="e.g. manager"
                value={managerUser}
                onChange={(e) => setManagerUser(e.target.value)}
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
                value={managerPass}
                onChange={(e) => setManagerPass(e.target.value)}
              />
            </div>

            {error ? <div className="form-error mb-2">{error}</div> : null}

            <button type="submit" className="place-order-btn w-full" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        )}

        {/* Demo credentials are shown ONLY in pure-local mode (no Supabase
            configured), where the bundled fallback accounts are genuinely the
            way in. With Supabase configured the real accounts are used, so
            printing working passwords on the public login screen would hand
            them to every visitor. */}
        {!isSupabaseConfigured && (
          <div className="login-credentials mt-3">
            <strong>Demo accounts (local mode)</strong>
            <div>
              <span>Manager</span> <code>manager</code> / <code>demo-manager-only</code>
            </div>
            <div className="mt-1">
              <span>Cashier PINs</span> set in Settings → Staff Management (default: 1234)
            </div>
          </div>
        )}

        <Link to="/" className="login-back-link">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}