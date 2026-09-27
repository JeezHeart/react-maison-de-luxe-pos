import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Control the Supabase layer so the two branches of authorizeManager can be
// tested without a network call or real credentials.
vi.mock('../src/lib/supabase.js', () => ({
  supabase: null,
  isSupabaseConfigured: true,
  verifyPassword: vi.fn(),
}));

const { verifyPassword } = await import('../src/lib/supabase.js');
const { useAuthStore, ACCOUNTS, USERNAME_TO_EMAIL, MANAGER_AUTH_MS } = await import(
  '../src/stores/authStore.js'
);

beforeEach(() => {
  vi.mocked(verifyPassword).mockReset();
  useAuthStore.setState({ managerAuthorizedUntil: 0 });
});

describe('bundled demo credentials', () => {
  it('are all prefixed demo- so they read as non-secrets in the bundle', () => {
    for (const account of ACCOUNTS) {
      expect(account.password.startsWith('demo-')).toBe(true);
    }
  });

  it('no longer contains the values published in git history', () => {
    const passwords = ACCOUNTS.map((a) => a.password);
    expect(passwords).not.toContain('123456');
    expect(passwords).not.toContain('admin123');
  });

  // The real risk this guards: a demo value that happens to equal a live staff
  // password would hand a working credential to anyone reading the bundle.
  // Skipped when .env is absent (CI has no secrets), never silently passed.
  it('never collides with a live staff password from .env', () => {
    const envPath = resolve('.env');
    if (!existsSync(envPath)) {
      console.warn('skipped: no .env in this working directory');
      return;
    }
    const env = {};
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([^#=\s][^=]*)=(.*)$/.exec(line);
      if (m) env[m[1].trim()] = m[2].trim();
    }
    const live = [env.POS_CASHIER_PASSWORD, env.POS_MANAGER_PASSWORD].filter(Boolean);
    expect(live.length).toBe(2);
    for (const account of ACCOUNTS) {
      expect(live).not.toContain(account.password);
    }
  });
});

describe('authorizeManager with Supabase configured', () => {
  it('checks the PIN against the real manager account', async () => {
    vi.mocked(verifyPassword).mockResolvedValue(true);
    const ok = await useAuthStore.getState().authorizeManager('a-real-pin');
    expect(verifyPassword).toHaveBeenCalledWith(USERNAME_TO_EMAIL.manager, 'a-real-pin');
    expect(ok).toBe(true);
  });

  it('opens the approval window on success', async () => {
    vi.mocked(verifyPassword).mockResolvedValue(true);
    await useAuthStore.getState().authorizeManager('a-real-pin');
    expect(useAuthStore.getState().managerAuthorizedUntil).toBeGreaterThan(Date.now());
    expect(useAuthStore.getState().managerAuthorizedUntil).toBeLessThanOrEqual(
      Date.now() + MANAGER_AUTH_MS
    );
  });

  it('leaves the window closed on a wrong PIN', async () => {
    vi.mocked(verifyPassword).mockResolvedValue(false);
    const ok = await useAuthStore.getState().authorizeManager('guess');
    expect(ok).toBe(false);
    expect(useAuthStore.getState().managerAuthorizedUntil).toBe(0);
  });

  it('never falls back to the bundled demo password when configured', async () => {
    // The regression that mattered: a hardcoded PIN in the public bundle.
    const demoManager = ACCOUNTS.find((a) => a.role === 'manager');
    vi.mocked(verifyPassword).mockResolvedValue(false);
    const ok = await useAuthStore.getState().authorizeManager(demoManager.password);
    expect(ok).toBe(false);
    expect(useAuthStore.getState().managerAuthorizedUntil).toBe(0);
  });

  it('rejects an empty PIN without calling Supabase', async () => {
    const ok = await useAuthStore.getState().authorizeManager('');
    expect(ok).toBe(false);
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it('returns a promise, so a slow check is never read as a wrong PIN', () => {
    const result = useAuthStore.getState().authorizeManager('a-real-pin');
    expect(result).toBeInstanceOf(Promise);
    return result;
  });
});

describe('authorizeManager in pure-local mode', () => {
  it('falls back to the bundled demo account when Supabase is absent', async () => {
    // verifyPassword returns null to mean "not configured".
    vi.mocked(verifyPassword).mockResolvedValue(null);
    const demoManager = ACCOUNTS.find((a) => a.role === 'manager');
    const ok = await useAuthStore.getState().authorizeManager(demoManager.password);
    expect(ok).toBe(true);
    expect(useAuthStore.getState().managerAuthorizedUntil).toBeGreaterThan(0);
  });

  it('still refuses a wrong PIN locally', async () => {
    vi.mocked(verifyPassword).mockResolvedValue(null);
    const ok = await useAuthStore.getState().authorizeManager('nope');
    expect(ok).toBe(false);
    expect(useAuthStore.getState().managerAuthorizedUntil).toBe(0);
  });

  it('does not accept the cashier demo password as a manager PIN', async () => {
    vi.mocked(verifyPassword).mockResolvedValue(null);
    const demoCashier = ACCOUNTS.find((a) => a.role === 'cashier');
    const ok = await useAuthStore.getState().authorizeManager(demoCashier.password);
    expect(ok).toBe(false);
  });
});
