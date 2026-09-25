import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

// Authentication & roles. With Supabase configured, the username login is
// mapped to a Supabase Auth account and the session is managed by the
// Supabase client. Without it, the app falls back to the bundled demo
// accounts below (pure-local mode). Manager PIN authorization stays a
// short window (5 minutes) that lets a cashier approve destructive
// actions without logging in as the manager.

export const STORAGE_KEY = 'luxury_pos_auth';
export const MANAGER_AUTH_MS = 5 * 60 * 1000;

// Login is username-based (cashier / manager) exactly like before; these
// usernames map to the Supabase Auth accounts created by the seeder.
export const USERNAME_TO_EMAIL = {
  cashier: 'cashier@maison.de.luxe',
  manager: 'manager@maison.de.luxe',
};

// Bundled demo accounts — used only when Supabase is NOT configured.
export const ACCOUNTS = [
  { username: 'manager', password: 'admin123', name: 'Store Manager', role: 'manager' },
  // Supabase enforces a 6+ character minimum password; the placeholder
  // '1234' demo login became '123456'.
  { username: 'cashier', password: '123456', name: 'Main Cashier', role: 'cashier' },
];

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.username || parsed.email)) {
        // Backfill fields older saved sessions are missing (name/role).
        const account = ACCOUNTS.find((a) => a.username === parsed.username);
        return {
          username: parsed.username,
          email: parsed.email || '',
          name: parsed.name || account?.name || parsed.username,
          role: parsed.role || account?.role || 'cashier',
        };
      }
    }
  } catch (e) {
    // ignore corrupt storage
  }
  return null;
}

function persistSession(user) {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {
    // storage unavailable; keep state in memory only
  }
}

// The seeder stores role/name on both the profile row and user_metadata,
// so role resolution works even if the profile write was skipped.
function roleFrom(user, email) {
  const fallbackRole = email === USERNAME_TO_EMAIL.manager ? 'manager' : 'cashier';
  return user?.user_metadata?.role || fallbackRole;
}

export const useAuthStore = create((set, get) => ({
  currentUser: loadSession(),

  // Restore a Supabase session on app load (refresh keeps you signed in).
  init: async () => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      set({ currentUser: null });
      persistSession(null);
      return;
    }
    const { user } = data.session;
    const email = user.email || '';
    const username = email === USERNAME_TO_EMAIL.manager ? 'manager' : 'cashier';
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, name')
      .eq('id', user.id)
      .maybeSingle();
    const currentUser = {
      username,
      email,
      name: profile?.name || user.user_metadata?.name || (username === 'manager' ? 'Store Manager' : 'Main Cashier'),
      role: profile?.role || roleFrom(user, email),
    };
    set({ currentUser });
    persistSession(currentUser);
  },

  login: async ({ username, password }) => {
    const uname = String(username || '').trim().toLowerCase();

    if (isSupabaseConfigured && supabase) {
      const email = USERNAME_TO_EMAIL[uname];
      if (!email) {
        return null;
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: String(password || ''),
      });
      if (error || !data?.user) {
        return null;
      }
      const { user } = data;
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, name')
        .eq('id', user.id)
        .maybeSingle();
      const currentUser = {
        username: uname,
        email: user.email,
        name: profile?.name || user.user_metadata?.name || (uname === 'manager' ? 'Store Manager' : 'Main Cashier'),
        role: profile?.role || roleFrom(user, user.email),
      };
      set({ currentUser });
      persistSession(currentUser);
      return currentUser;
    }

    // Local fallback accounts.
    const account = ACCOUNTS.find(
      (a) =>
        a.username === uname && a.password === String(password || '')
    );
    if (!account) {
      return null;
    }
    const user = { username: account.username, name: account.name, role: account.role };
    set({ currentUser: user });
    persistSession(user);
    return user;
  },

  logout: async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        // offline sign-out still clears the local session below
      }
    }
    set({ currentUser: null, managerAuthorizedUntil: 0 });
    persistSession(null);
  },

  // Cashier-facing destructive actions check this before running.
  managerAuthorizedUntil: 0,
  authorizeManager: (pin) => {
    const ok = ACCOUNTS.some(
      (a) => a.role === 'manager' && a.password === String(pin || '')
    );
    if (!ok) {
      return false;
    }
    set({ managerAuthorizedUntil: Date.now() + MANAGER_AUTH_MS });
    return true;
  },

  isManager: (user = get().currentUser) => Boolean(user && user.role === 'manager'),
}));