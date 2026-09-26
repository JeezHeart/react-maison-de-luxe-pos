// Post-deploy smoke check against the live deployment: confirms the site is
// serving, the app can reach Supabase from the production origin (CORS), and
// the staff login path still works end to end. Read-only apart from the login
// itself; it writes nothing.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const ORIGIN = process.argv[2] || 'https://maison-de-luxe-pos.vercel.app';
const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const cashierPw = env.POS_CASHIER_PASSWORD;

let failures = 0;
const check = (ok, label, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
};

// 1. The site itself is up.
const page = await fetch(`${ORIGIN}/`);
check(page.ok, 'site responds', `HTTP ${page.status}`);

// 2. The logo is the small one, not the 2 MB original.
const logo = await fetch(`${ORIGIN}/assets/images/maison-logo-mark.png`);
const logoBytes = Number(logo.headers.get('content-length') || 0);
check(logo.ok && logoBytes > 0 && logoBytes < 200_000, 'logo served at web size', `${logoBytes} bytes`);

// 3. Supabase is reachable from the production origin (CORS + valid key).
const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = await supabase.from('menu_items').select('id', { count: 'exact', head: true });
check(anon.status === 401 || anon.status === 403, 'anonymous read is refused (RLS)', `HTTP ${anon.status}`);

// 4. Staff login works from this machine against the live project.
const { data: session, error } = await supabase.auth.signInWithPassword({
  email: 'cashier@maison.de.luxe',
  password: cashierPw,
});
check(!error && Boolean(session?.user), 'staff sign-in works', session?.user?.email ?? error?.message);

// 5. Authenticated read returns real data.
const { data: rows, error: readErr } = await supabase
  .from('menu_items')
  .select('id, name, price')
  .limit(3);
check(!readErr && Array.isArray(rows) && rows.length > 0, 'authenticated read returns data', `${rows?.length ?? 0} rows`);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
