// Restore menu items deleted from the shared catalog.
//
// The canonical 48-item menu (src/data/menu.js) is the reference: anything
// in the seed that is missing from the cloud `menu_items` table was deleted
// (or never seeded). Running without flags reports the diff; with --apply
// the missing items are upserted back with their seed values. Surgical —
// existing rows (prices, stock, descriptions) are left untouched.
//
//   node --env-file=.env scripts/restore-menu.mjs            # report only
//   node --env-file=.env scripts/restore-menu.mjs --apply    # restore
//
// Sign-in uses the manager staff account (publishable key only; no secret).
// The password comes from POS_MANAGER_PASSWORD in your .env.

import { createClient } from '@supabase/supabase-js';
import { staffPassword } from './staff-password.mjs';
import { MENU_ITEMS } from '../src/data/menu.js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in .env');
  process.exit(1);
}

const apply = process.argv.includes('--apply');

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = 'manager@maison.de.luxe';
const { error: signInErr } = await supabase.auth.signInWithPassword({
  email,
  password: staffPassword('manager'),
});
if (signInErr) {
  console.error(`Sign-in failed: ${signInErr.message}`);
  process.exit(1);
}
console.log(`signed in as ${email}`);

const { data: rows, error } = await supabase
  .from('menu_items')
  .select('id, name, category, description, price, stock')
  .order('id');
if (error) {
  console.error(`Read failed: ${error.message}`);
  process.exit(1);
}

const byName = new Map((rows || []).map((r) => [r.name, r]));
const missing = MENU_ITEMS.filter((m) => !byName.has(m.name));

console.log(`cloud menu_items: ${rows.length} rows, seed: ${MENU_ITEMS.length} items`);
if (missing.length === 0) {
  console.log('No seed items are missing — nothing to restore.');
  process.exit(0);
}

console.log(`\nMissing from cloud (${missing.length}):`);
for (const m of missing) {
  const live = byName.get(m.name);
  console.log(`  - ${m.name}  (${m.category}, ₱${m.price}, stock ${m.stock})${live ? ' [present,but differs? no — comparing by name]' : ''}`);
}

if (!apply) {
  console.log('\nRun with --apply to restore these items.');
  process.exit(0);
}

for (const m of missing) {
  const { error: upsertErr } = await supabase.from('menu_items').upsert(
    {
      // Carry the seed id so the restored row is byte-for-byte identical to
      // the original (the app replays local ids the same way). Omitting id
      // would rely on the identity sequence, which can drift when earlier
      // rows were seeded with explicit ids.
      id: m.id,
      name: m.name,
      category: m.category,
      description: m.description,
      price: m.price,
      stock: m.stock,
    },
    { onConflict: 'name' }
  );
  if (upsertErr) {
    console.error(`  restore "${m.name}" FAILED: ${upsertErr.message}`);
    process.exit(1);
  }
  console.log(`  restored "${m.name}" (id ${m.id})`);
}

const { data: after } = await supabase.from('menu_items').select('name').order('id');
console.log(`\ncloud menu_items now: ${after.length} rows (${MENU_ITEMS.length} expected).`);