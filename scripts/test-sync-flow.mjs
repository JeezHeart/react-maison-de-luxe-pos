// Integration test — drives the app's REAL store + sync modules in Node,
// the same code the browser runs, against the live Supabase project.
//
//   node scripts/test-sync-flow.mjs   (loads .env automatically)
//
// Flow: log in (Supabase) -> place an order (local-first) -> flush the
// queue -> verify rows landed in Postgres -> pull remote -> verify merge.

import { staffPassword } from './staff-password.mjs';

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
const { useCartStore } = await import('../src/stores/cartStore.js');
const { useCustomerStore } = await import('../src/stores/customerStore.js');
const { useSettingsStore } = await import('../src/stores/settingsStore.js');
const { flushQueue, readQueue } = await import('../src/lib/sync.js');

// 1) Sign in as the cashier through the store (Supabase path).
const loggedIn = await useAuthStore.getState().login({
  username: 'cashier',
  password: staffPassword('cashier'),
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

// Deleting the order must return the sold stock (no phantom inventory loss).
const { data: stockAfterDelete } = await supabase
  .from('menu_items')
  .select('stock')
  .eq('name', 'Avocado Toast')
  .single();
check(
  'deleteOrder restores the sold stock',
  stockAfterDelete && Number(stockAfterDelete.stock) === Number(beforeStock),
  `stock=${stockAfterDelete?.stock}`
);

// 6b) Cart oversell guard — can't go past available stock.
const avoId = useMenuStore.getState().items.find((m) => m.name === 'Avocado Toast').id;
const avoStock = Number(useMenuStore.getState().items.find((m) => m.name === 'Avocado Toast').stock);
let acceptedAll = true;
for (let i = 0; i < avoStock; i += 1) {
  acceptedAll = useCartStore.getState().addToCart(avoId, 'Avocado Toast', 460) && acceptedAll;
}
check(
  'cart accepts quantity up to stock',
  acceptedAll && useCartStore.getState().items[0].qty === avoStock,
  `qty=${useCartStore.getState().items[0]?.qty}`
);
const blockedAdd = useCartStore.getState().addToCart(avoId, 'Avocado Toast', 460);
check(
  'cart blocks quantity over stock',
  blockedAdd === false && useCartStore.getState().items[0].qty === avoStock,
  blockedAdd ? 'allowed past stock' : 'blocked'
);
useCartStore.getState().changeQty(avoId, 1);
check(
  'cart + button respects the stock cap',
  useCartStore.getState().items[0].qty === avoStock,
  `qty=${useCartStore.getState().items[0]?.qty}`
);
useCartStore.getState().changeQty(avoId, -5);
check(
  'cart - button reduces freely',
  useCartStore.getState().items[0].qty === avoStock - 5,
  `qty=${useCartStore.getState().items[0]?.qty}`
);
useCartStore.getState().clear();

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
useCustomerStore.getState().deleteCustomer(
  useCustomerStore.getState().customers.find((c) => c.name === 'Sync Test Patron').id
);
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

// 7c) Rename lifecycle — the old name must be dropped, not orphaned.
const tofu = useMenuStore.getState().items.find((m) => m.name === 'Tofu Scramble');
useMenuStore.getState().updateItem(tofu.id, { name: 'Tofu Scramble Test' });
await flushQueue();
const { data: renamedMenu } = await supabase
  .from('menu_items')
  .select('name, stock')
  .eq('name', 'Tofu Scramble Test')
  .single();
const { data: oldMenuRow } = await supabase
  .from('menu_items')
  .select('id')
  .eq('name', 'Tofu Scramble')
  .maybeSingle();
check(
  'menu rename keeps new row, drops old',
  !!renamedMenu && !oldMenuRow,
  renamedMenu ? `stock=${renamedMenu.stock}` : 'missing'
);
useMenuStore.getState().updateItem(tofu.id, { name: 'Tofu Scramble' });
await flushQueue();
const { data: backToTofu } = await supabase
  .from('menu_items')
  .select('name, stock')
  .eq('name', 'Tofu Scramble')
  .single();
const { data: orphanRow } = await supabase
  .from('menu_items')
  .select('id')
  .eq('name', 'Tofu Scramble Test')
  .maybeSingle();
check(
  'rename back restores original, no orphan',
  !!backToTofu && !orphanRow && Number(backToTofu.stock) === 11,
  backToTofu ? `stock=${backToTofu.stock}` : 'missing'
);

useCustomerStore.getState().addCustomer({
  name: 'Rename Test Guest',
  visits: 2,
  total_spent: 0,
  tier: 'Bronze',
});
await flushQueue();
const customerForRename = useCustomerStore
  .getState()
  .customers.find((c) => c.name === 'Rename Test Guest');
useCustomerStore.getState().updateCustomer(customerForRename.id, { name: 'Rename Test Valued' });
await flushQueue();
const { data: renamedCust } = await supabase
  .from('customers')
  .select('name')
  .eq('name', 'Rename Test Valued')
  .single();
const { data: oldCustRow } = await supabase
  .from('customers')
  .select('id')
  .eq('name', 'Rename Test Guest')
  .maybeSingle();
check(
  'customer rename keeps new, drops old',
  !!renamedCust && !oldCustRow,
  renamedCust ? `name=${renamedCust.name}` : 'missing'
);
useCustomerStore.getState().deleteCustomer(customerForRename.id);
await flushQueue();
const { data: goneRenameCust } = await supabase
  .from('customers')
  .select('id')
  .eq('name', 'Rename Test Valued')
  .maybeSingle();
check('renamed customer cleanup', !goneRenameCust);

// 8) Undo round-trips: menu delete -> restore -> hard delete, all cloud-synced.
const dish = useMenuStore.getState().addItem({
  name: 'Restore Test Dish',
  category: 'Breakfast',
  description: '',
  price: 120,
  stock: 5,
});
check('restore: menu item created (local)', !!dish);
await flushQueue();
const { data: dishInCloud } = await supabase
  .from('menu_items')
  .select('id')
  .eq('name', 'Restore Test Dish')
  .maybeSingle();
check('restore: menu item reached cloud', !!dishInCloud);

useMenuStore.getState().deleteItem(dish.id);
await flushQueue();
const { data: dishGone } = await supabase
  .from('menu_items')
  .select('id')
  .eq('name', 'Restore Test Dish')
  .maybeSingle();
check('restore: menu delete removed cloud row', !dishGone);

useMenuStore.getState().restoreItem(dish);
await flushQueue();
const { data: dishBack } = await supabase
  .from('menu_items')
  .select('name, stock')
  .eq('name', 'Restore Test Dish')
  .single();
check(
  'restore: menu undo brings row back',
  dishBack && Number(dishBack.stock) === 5,
  dishBack ? `stock=${dishBack.stock}` : 'missing'
);

useMenuStore.getState().deleteItem(dish.id);
await flushQueue();
const { data: dishGoneFinal } = await supabase
  .from('menu_items')
  .select('id')
  .eq('name', 'Restore Test Dish')
  .maybeSingle();
check('restore: menu row hard-deleted cleanly', !dishGoneFinal);

// Same round-trip for the customer directory.
const guest = useCustomerStore.getState().addCustomer({
  name: 'Restore Test Guest',
  visits: 0,
  total_spent: 0,
  tier: 'Bronze',
});
useCustomerStore.getState().deleteCustomer(guest.id);
await flushQueue();
const { data: guestGone } = await supabase
  .from('customers')
  .select('id')
  .eq('name', 'Restore Test Guest')
  .maybeSingle();
check('restore: customer delete reached cloud', !guestGone);

useCustomerStore.getState().restoreCustomer(guest);
await flushQueue();
const { data: guestBack } = await supabase
  .from('customers')
  .select('id')
  .eq('name', 'Restore Test Guest')
  .single();
check('restore: customer undo brings row back', !!guestBack);

useCustomerStore.getState().deleteCustomer(guest.id);
await flushQueue();
const { data: guestFinal } = await supabase
  .from('customers')
  .select('id')
  .eq('name', 'Restore Test Guest')
  .maybeSingle();
check('restore: customer row hard-deleted cleanly', !guestFinal);

// Final proof the whole run left the inventory at its baseline.
const { data: avoFinal } = await supabase
  .from('menu_items')
  .select('stock')
  .eq('name', 'Avocado Toast')
  .single();
check(
  'stock back to baseline (no residue)',
  avoFinal && Number(avoFinal.stock) === Number(beforeStock),
  `stock=${avoFinal?.stock}`
);

// 9) Logout clears the local session.
await useAuthStore.getState().logout();
check('logout clears session', !useAuthStore.getState().currentUser);

console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);