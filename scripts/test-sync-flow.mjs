// Integration test — drives the app's REAL store + sync modules in Node,
// the same code the browser runs, against the live Supabase project.
//
//   node scripts/test-sync-flow.mjs   (loads .env automatically)
//
// Flow: log in (Supabase) -> place an order (local-first) -> flush the
// queue -> verify rows landed in Postgres -> pull remote -> verify merge.

// --- localStorage polyfill (browser-only API) -------------------------------
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.window = globalThis;

const results = [];
const check = (label, ok, detail = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const { supabase, isSupabaseConfigured } = await import('../src/lib/supabase.js');
if (!isSupabaseConfigured) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.');
  process.exit(1);
}

// --- Load the real stores (they read localStorage on import) ----------------
const { useAuthStore } = await import('../src/stores/authStore.js');
const { useOrderStore } = await import('../src/stores/orderStore.js');
const { useMenuStore } = await import('../src/stores/menuStore.js');
const { useCustomerStore } = await import('../src/stores/customerStore.js');
const { useSettingsStore } = await import('../src/stores/settingsStore.js');
const { flushQueue, readQueue } = await import('../src/lib/sync.js');

// 1) Sign in as the cashier through the store (Supabase path).
const loggedIn = await useAuthStore.getState().login({
  username: 'cashier',
  password: '123456',
});
check('login as cashier', !!loggedIn && loggedIn.role === 'cashier', loggedIn?.name);

// 2) Place a real order through the store — local-first + enqueued.
const beforeOrder = useOrderStore.getState().orders.length;
const beforeStock = useMenuStore.getState().items.find((m) => m.name === 'Avocado Toast')?.stock;
const placed = useOrderStore.getState().placeOrder({
  customerName: 'Sync Test Customer',
  paymentMethod: 'Cash Payout',
  orderType: 'Dine-in',
  items: [{ name: 'Avocado Toast', qty: 1, price: 460 }],
  subTotal: 460,
  discountLabel: '',
  discountAmount: 0,
  taxAmount: 46,
  totalAmount: 506,
  cashTendered: 600,
  changeAmount: 94,
});
check(
  'placeOrder is instant (local-first)',
  useOrderStore.getState().orders.length === beforeOrder + 1,
  `local orders before=${beforeOrder} after=${useOrderStore.getState().orders.length}`
);
check('order id assigned', placed && placed.id > 0, `id=${placed?.id}`);
check('queue received 2 ops (order + menu stock)', readQueue().length === 2, `${readQueue().length} queued`);

// 3) Flush the queue to Postgres.
const sent = await flushQueue();
check('flushQueue sent all ops', sent === 2, `sent ${sent}`);

// 4) Verify in the database as the signed-in cashier.
const { data: dbOrder, error: dbErr } = await supabase
  .from('orders')
  .select('*, order_items(name, quantity, unit_price)')
  .eq('id', placed.id)
  .single();
check('order row in Postgres', !dbErr && dbOrder, dbErr?.message || `id=${placed.id}`);
if (dbOrder) {
  check(
    'order_items saved',
    dbOrder.order_items?.length === 1 && dbOrder.order_items[0].name === 'Avocado Toast',
    `${dbOrder.order_items?.length} item(s)`
  );
  check('payment/status stored', dbOrder.payment_method === 'Cash Payout' && dbOrder.order_status === 'Completed');
  check('cash tendered stored', Number(dbOrder.cash_tendered) === 600 && Number(dbOrder.change_amount) === 94);
}
const { data: dbMenu } = await supabase
  .from('menu_items')
  .select('stock, name')
  .eq('name', 'Avocado Toast')
  .single();
check(
  'menu stock decremented in Postgres',
  dbMenu && Number(dbMenu.stock) === Number(beforeStock) - 1,
  `${beforeStock} -> ${dbMenu?.stock}`
);

// 5) Pull remote state back down (as the app does after each sync pass).
await useOrderStore.getState().syncFromRemote();
const afterPull = useOrderStore.getState().orders.length;
check('syncFromRemote merges remote orders', afterPull >= 16, `local after pull=${afterPull}`);
const worst = new Date();
check(
  'newest order present after pull',
  useOrderStore.getState().orders.some((o) => o.id === placed.id && o.customer_name === 'Sync Test Customer'),
  `created_at=${useOrderStore.getState().orders.find((o) => o.id === placed.id)?.created_at}`
);

// 6) Status update + delete lifecycle through the store (queued, flushed).
useOrderStore.getState().updateOrderStatus(placed.id, 'Pending');
await flushQueue();
const { data: statusNow } = await supabase
  .from('orders')
  .select('order_status')
  .eq('id', placed.id)
  .single();
check('updateOrderStatus reaches Postgres', statusNow?.order_status === 'Pending', statusNow?.order_status);

useOrderStore.getState().deleteOrder(placed.id);
await flushQueue();
const { data: gone, error: goneErr } = await supabase
  .from('orders')
  .select('id')
  .eq('id', placed.id)
  .maybeSingle();
check(
  'deleteOrder removes row + cascades items',
  !goneErr && !gone,
  gone ? 'still present' : goneErr?.message || 'gone'
);

// 7) Menu + settings pull work as authenticated user.
await useMenuStore.getState().syncFromRemote();
check('menu syncFromRemote', useMenuStore.getState().items.length >= 40);
await useSettingsStore.getState().syncFromRemote();
check(
  'settings syncFromRemote',
  useSettingsStore.getState().restaurantName === 'Maison de Luxe',
  useSettingsStore.getState().restaurantName
);

// 7b) Customer CRUD through the store -> queue -> Postgres.
const createdCustomer = useCustomerStore.getState().addCustomer({
  name: 'Sync Test Patron',
  phone: '0917 000 0000',
  email: 'patron@test.local',
  visits: 1,
  total_spent: 100,
  tier: 'Bronze',
});
check('customerStore addCustomer (local-first)', !!createdCustomer, `id=${createdCustomer?.id}`);
await flushQueue();
const { data: dbCust } = await supabase
  .from('customers')
  .select('*')
  .eq('name', 'Sync Test Patron')
  .single();
check('customer upsert reaches Postgres', !!dbCust && dbCust.tier === 'Bronze', dbCust ? `id=${dbCust.id}` : 'missing');
useCustomerStore.getState().updateCustomer(createdCustomer.id, { tier: 'Silver', total_spent: 250 });
await flushQueue();
const { data: dbCust2 } = await supabase
  .from('customers')
  .select('tier, total_spent')
  .eq('name', 'Sync Test Patron')
  .single();
check(
  'customer update reaches Postgres',
  dbCust2?.tier === 'Silver' && Number(dbCust2.total_spent) === 250,
  dbCust2 ? `tier=${dbCust2.tier} spent=${dbCust2.total_spent}` : 'missing'
);
await useCustomerStore.getState().syncFromRemote();
check(
  'customer syncFromRemote pulls directory',
  useCustomerStore.getState().customers.some((c) => c.name === 'Sync Test Patron'),
  `${useCustomerStore.getState().customers.length} customers`
);
useCustomerStore.getState().deleteCustomer(createdCustomer.id);
await flushQueue();
const { data: goneCust, error: goneCustErr } = await supabase
  .from('customers')
  .select('id')
  .eq('name', 'Sync Test Patron')
  .maybeSingle();
check(
  'customer delete reaches Postgres',
  !goneCustErr && !goneCust,
  goneCust ? 'still present' : goneCustErr?.message || 'gone'
);

// 8) Clean up: restore the test order's stock so the DB is left clean.
const avo = useMenuStore.getState().items.find((m) => m.name === 'Avocado Toast');
if (avo) {
  useMenuStore.getState().updateItem(avo.id, { stock: beforeStock });
  await flushQueue();
  const { data: restored } = await supabase
    .from('menu_items')
    .select('stock')
    .eq('name', 'Avocado Toast')
    .single();
  check('menu stock restored (cleanup)', restored && Number(restored.stock) === Number(beforeStock), `stock=${restored?.stock}`);
}

// 9) Logout clears the local session.
await useAuthStore.getState().logout();
check('logout clears session', !useAuthStore.getState().currentUser);

console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);