// End-to-end smoke test of the exact API path the browser app uses:
// publishable/anon key + signed-in staff session (authenticated role).
//   node scripts/smoke-test.mjs   (loads .env automatically)

import { createClient } from '@supabase/supabase-js';
import { staffPassword } from './staff-password.mjs';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing Supabase URL or publishable/anon key env vars.');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const checks = [];
const count = async (label, table) => {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  checks.push(`${label}: ${error ? `ERROR -> ${error.message}` : `${count} rows`}`);
};

// 1. Sign in as the cashier (authenticated role).
const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
  email: 'cashier@maison.de.luxe',
  password: staffPassword('cashier'),
});
if (signInError || !signIn.user) {
  console.error(`SIGN IN failed: ${signInError?.message || 'no user'}`);
  process.exit(1);
}
console.log(`OK  sign-in as ${signIn.user.email}`);

// 2. Reads on every business table.
await count('menu_items', 'menu_items');
await count('orders', 'orders');
await count('order_items', 'order_items');
await count('customers', 'customers');
await count('settings', 'settings');
await count('profiles', 'profiles');

// 3. Write path: insert a probe settings row, read it back, delete it.
const probeKey = '__smoke_test__';
const { error: insErr } = await supabase
  .from('settings')
  .upsert({ key: probeKey, value: 'probe' }, { onConflict: 'key' });
if (insErr) {
  checks.push(`settings WRITE: ERROR -> ${insErr.message}`);
} else {
  const { data: back, error: readBackErr } = await supabase
    .from('settings')
    .select('value')
    .eq('key', probeKey)
    .single();
  const deleted = await supabase.from('settings').delete().eq('key', probeKey);
  checks.push(
    `settings WRITE: ${readBackErr || !back ? `ERROR -> ${readBackErr?.message || 'no row'}` : `OK (round-tripped "${back.value}")`}${deleted.error ? ` / CLEANUP ERROR -> ${deleted.error.message}` : ''}`
  );
}

// 4. Full order lifecycle, mirroring the app's dispatchOrder flow:
//    upsert order (explicit id) -> replace items -> update status -> delete (cascade).
const probeOrderId = 900001;
const orderRow = {
  id: probeOrderId,
  customer_name: 'Smoke Test',
  order_type: 'Dine-in',
  sub_total: 1100,
  discount_amount: 0,
  discount_label: '',
  tax_amount: 110,
  total_amount: 1210,
  payment_method: 'Cash Payout',
  order_status: 'Completed',
  cash_tendered: 1500,
  change_amount: 290,
  cashier_name: 'Main Cashier',
  created_at: new Date().toISOString(),
};
const itemRows = [
  { order_id: probeOrderId, name: 'Avocado Toast', quantity: 2, unit_price: 460, subtotal: 920 },
  { order_id: probeOrderId, name: 'Hot Chocolate', quantity: 1, unit_price: 260, subtotal: 260 },
];

// a) upsert order, then replace its items (delete + insert)
const u1 = await supabase.from('orders').upsert(orderRow, { onConflict: 'id' });
if (!u1.error) {
  await supabase.from('order_items').delete().eq('order_id', probeOrderId);
  const u2 = await supabase.from('order_items').insert(itemRows);
  checks.push(`order UPSERT+ITEMS: ${u2.error ? `ERROR -> ${u2.error.message}` : 'OK'}`);
} else {
  checks.push(`order UPSERT+ITEMS: ERROR -> ${u1.error.message}`);
}

// b) status update
const { error: u3 } = await supabase
  .from('orders')
  .update({ order_status: 'Pending' })
  .eq('id', probeOrderId);
checks.push(`order STATUS UPDATE: ${u3 ? `ERROR -> ${u3.message}` : 'OK'}`);

// c) read back with items
const { data: orderBack, error: u4 } = await supabase
  .from('orders')
  .select('id, order_status, order_items(id, name, quantity)')
  .eq('id', probeOrderId)
  .single();
checks.push(
  `order READ-BACK: ${
    u4 ? `ERROR -> ${u4.message}` : `OK (status=${orderBack.order_status}, items=${orderBack.order_items?.length ?? 0})`
  }`
);

// d) delete -> items should cascade away
const { error: u5 } = await supabase.from('orders').delete().eq('id', probeOrderId);
const { count: orphanItems } = await supabase
  .from('order_items')
  .select('*', { count: 'exact', head: true })
  .eq('order_id', probeOrderId);
checks.push(
  `order DELETE (cascade): ${u5 ? `ERROR -> ${u5.message}` : `OK (orphan items=${orphanItems})`}`
);

console.log(checks.join('\n'));
process.exit(0);