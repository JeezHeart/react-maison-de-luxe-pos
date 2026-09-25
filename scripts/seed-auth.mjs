// One-time seeder: creates the demo staff accounts in Supabase Auth
// (cashier + manager) and their profiles. Run from the project root:
//
//   $env:SUPABASE_URL="https://xxxx.supabase.co"
//   $env:SUPABASE_SECRET_KEY="sb_secret_..."        (new key style)
//   # or the legacy form: $env:SUPABASE_SERVICE_ROLE_KEY="eyJ...service_role..."
//   node scripts/seed-auth.mjs
//
// Uses an admin credential (full access) — server-side only, never
// committed, never used by the browser app.

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) env vars.'
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USERS = [
  {
    email: 'cashier@maison.de.luxe',
    // Supabase enforces a 6-character minimum password length.
    // (Matching the old demo login cashier/1234 would require lowering it
    // in Authentication -> Providers -> Email settings.)
    password: '123456',
    role: 'cashier',
    name: 'Main Cashier',
  },
  {
    email: 'manager@maison.de.luxe',
    password: 'admin123',
    role: 'manager',
    name: 'Store Manager',
  },
];

for (const u of USERS) {
  // Create (or re-fetch) the auth user, email pre-confirmed.
  const { data: created, error } = await supabase.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: { role: u.role, name: u.name },
  });

  const userId = created?.user?.id;
  if (error || !userId) {
    console.error(`Could not create ${u.email}: ${error?.message ?? 'no id returned'}`);
    continue;
  }

  // Upsert the matching profile row.
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ id: userId, role: u.role, name: u.name }, { onConflict: 'id' });

  if (profileError) {
    console.error(`Profile upsert failed for ${u.email}: ${profileError.message}`);
  } else {
    console.log(`OK  ${u.email}  (${u.role})`);
  }
}

console.log('\nDone. Logins: cashier@maison.de.luxe / 123456, manager@maison.de.luxe / admin123');