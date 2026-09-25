import { create } from 'zustand';

// Authentication & roles. Sessions persist in localStorage so a refresh
// keeps the current user signed in. Manager PIN authorization is a short
// window (5 minutes) that lets a cashier approve destructive actions
// without logging in as the manager.

export const STORAGE_KEY = 'luxury_pos_auth';
export const MANAGER_AUTH_MS = 5 * 60 * 1000;

// Demo accounts. Production would hash these, but this is a mock-only app.
export const ACCOUNTS = [
  { username: 'manager', password: 'admin123', name: 'Store Manager', role: 'manager' },
  { username: 'cashier', password: '1234', name: 'Main Cashier', role: 'cashier' },
];

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.username) {
        const account = ACCOUNTS.find((a) => a.username === parsed.username);
        if (account) {
          return { username: account.username, name: account.name, role: account.role };
        }
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ username: user.username }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {
    // storage unavailable; keep state in memory only
  }
}

export const useAuthStore = create((set, get) => ({
  currentUser: loadSession(),

  login: ({ username, password }) => {
    const account = ACCOUNTS.find(
      (a) => a.username === String(username || '').trim().toLowerCase() &&
        a.password === String(password || '')
    );
    if (!account) {
      return null;
    }
    const user = { username: account.username, name: account.name, role: account.role };
    set({ currentUser: user });
    persistSession(user);
    return user;
  },

  logout: () => {
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