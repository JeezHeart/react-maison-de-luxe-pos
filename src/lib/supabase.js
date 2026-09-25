import { createClient } from '@supabase/supabase-js';

// Resolve Vite env vars. Guarded so the module is also importable in
// plain Node (scripts/tests read from process.env instead).
const viteEnv = (typeof import.meta !== 'undefined' && import.meta.env) || {};
const supabaseUrl = viteEnv.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
// Prefer the new publishable key (sb_publishable_...); fall back to the
// legacy anon JWT for projects that haven't migrated yet. Both resolve to
// the same anon/authenticated roles behind Row Level Security. The secret
// key (sb_secret_...) must NEVER be used here — it bypasses RLS.
const supabaseKey =
  viteEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
  viteEnv.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

// The app runs fully on localStorage when Supabase isn't configured
// (e.g. local dev before credentials are provided). When configured,
// it becomes a local-first sync client: localStorage for instant/offline
// reads, Supabase as the shared source of truth.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;