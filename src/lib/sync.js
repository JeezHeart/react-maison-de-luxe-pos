// Offline-first sync core.
//
// The app always writes to localStorage first (instant + offline). Every
// write is also appended to a persistent sync queue (localStorage). When
// the device is back online we replay the queue against Supabase, then
// pull the shared state back down. Supabase is the source of truth;
// localStorage is the cache that keeps the POS usable with no network.
//
// Queue op shapes (single "op" object, all with { table, action, ... }):
//   orders:
//     { table:'orders', action:'insert', payload: fullOrder }  // payload has id
//     { table:'orders', action:'update', id,  payload: { order_status } }
//     { table:'orders', action:'delete', id }
//   menu:
//     { table:'menu', action:'upsert', payload: fullItem }  // unique by name
//     { table:'menu', action:'delete', name }
//   customers:
//     { table:'customers', action:'upsert', payload: fullCustomer }  // unique by name
//     { table:'customers', action:'delete', name }
//   settings:
//     { table:'settings', action:'upsert', payload: { key, value } }

import { supabase, isSupabaseConfigured } from './supabase.js';
import { round2, parseDate } from '../utils/format.js';

const QUEUE_KEY = 'luxury_pos_sync_queue';

export function readQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function writeQueue(queue) {
  try {
    // Keep the queue trimmed — a failed op stays for retry, but drop
    // anything that has been sitting stuck for a long time so a poisoned
    // row can never wedge the register forever.
    const now = Date.now();
    const trimmed = queue.filter((op) => now - (op.ts || 0) < 7 * 24 * 3600 * 1000);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    // storage unavailable; queue is best-effort only
  }
}

// Append an op and persist the queue. No-ops when Supabase isn't
// configured — the app stays purely local.
export function enqueue(op) {
  if (!isSupabaseConfigured) {
    return;
  }
  const queue = readQueue();
  queue.push({ ...op, ts: Date.now() });
  writeQueue(queue);
  for (const listener of queueListeners) {
    listener();
  }
}

// Listeners fired whenever new work lands in the queue, so the sync
// controller can react within ~a second instead of waiting for its
// periodic tick (keeps multiple registers near-real-time).
const queueListeners = new Set();
export function onQueueChange(listener) {
  queueListeners.add(listener);
  return () => queueListeners.delete(listener);
}

// Fired when the database refused to satisfy a stock movement because another
// register had already sold the units. The sale stands, but the count is known
// to be wrong, so this has to reach a person rather than stay in a log.
const shortfallListeners = new Set();
export function onStockShortfall(listener) {
  shortfallListeners.add(listener);
  return () => shortfallListeners.delete(listener);
}
function notifyStockShortfall(detail) {
  for (const listener of shortfallListeners) {
    try {
      listener(detail);
    } catch (e) {
      // a broken listener must not strand the op in the queue
    }
  }
}

// ---------------------------------------------------------------------------
// Dispatch helpers — one DB write per queued op.
// ---------------------------------------------------------------------------

function toRemoteDate(value) {
  const date = parseDate(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

// Mirrors orderStore.getOrderDetails so legacy orders (no stored subtotal)
// round-trip through Postgres with consistent numbers.
export function toRemoteOrder(order) {
  const total = Number(order.total_amount) || 0;
  const hasBreakdown = order.sub_total != null && order.tax_amount != null;
  const subTotal = hasBreakdown
    ? round2(Number(order.sub_total))
    : round2(total / 1.1);
  const taxTotal = hasBreakdown
    ? round2(Number(order.tax_amount))
    : round2(total - subTotal);

  return {
    orderRow: {
      id: Number(order.id),
      customer_name: order.customer_name || 'Walk-in Customer',
      order_type: order.order_type || 'Dine-in',
      sub_total: subTotal,
      discount_amount: round2(Number(order.discount_amount) || 0),
      discount_label: order.discount_label || '',
      tax_amount: taxTotal,
      total_amount: total,
      payment_method: order.payment_method || 'Cash Payout',
      order_status: order.order_status || 'Completed',
      cash_tendered: order.cash_tendered != null ? round2(Number(order.cash_tendered)) : null,
      change_amount: order.change_amount != null ? round2(Number(order.change_amount)) : null,
      cashier_name: order.cashier_name || '',
      created_at: toRemoteDate(order.created_at),
    },
    itemRows: (order.items || []).map((i) => ({
      order_id: Number(order.id),
      name: i.name,
      quantity: Number(i.quantity) || 1,
      unit_price: round2(Number(i.unit_price)),
      subtotal:
        i.subtotal != null
          ? round2(Number(i.subtotal))
          : round2((Number(i.quantity) || 1) * (Number(i.unit_price) || 0)),
    })),
  };
}

async function replaceOrderItems(itemRows) {
  const orderIds = [...new Set(itemRows.map((r) => r.order_id))];
  if (orderIds.length) {
    const { error } = await supabase.from('order_items').delete().in('order_id', orderIds);
    if (error) throw error;
  }
  if (itemRows.length) {
    const { error } = await supabase.from('order_items').insert(itemRows);
    if (error) throw error;
  }
}

async function dispatchOrder(op) {
  if (op.action === 'delete') {
    // order_items cascade on delete — one call clears the whole order.
    const { error } = await supabase.from('orders').delete().eq('id', Number(op.id));
    if (error) throw error;
    return;
  }
  if (op.action === 'update') {
    const { error } = await supabase
      .from('orders')
      .update({ ...op.payload })
      .eq('id', Number(op.id));
    if (error) throw error;
    return;
  }
  // insert / restore — upsert so a retried op never double-creates.
  const { orderRow, itemRows } = toRemoteOrder(op.payload);
  const { error: orderError } = await supabase
    .from('orders')
    .upsert(orderRow, { onConflict: 'id' });
  if (orderError) throw orderError;
  await replaceOrderItems(itemRows);
}

async function dispatchMenu(op) {
  if (op.action === 'delete') {
    const { error } = await supabase.from('menu_items').delete().eq('name', op.name);
    if (error) throw error;
    return;
  }
  const item = op.payload || {};
  const row = {
    name: item.name,
    category: item.category,
    description: item.description || '',
    price: round2(Number(item.price) || 0),
  };
  // Stock is owned by apply_stock_movement. Writing an absolute number here
  // would resurrect the lost update this replaced: a manager editing a price
  // carries whatever stock this device happens to believe in, and that would
  // overwrite whatever the server has since decremented. Only a row that does
  // not exist yet seeds its own stock.
  if (op.setStock) {
    row.stock = Math.max(0, Number(item.stock) || 0);
  }
  const { error } = await supabase.from('menu_items').upsert(row, { onConflict: 'name' });
  if (error) throw error;
}

// Before migration 0003 the database has no apply_stock_movement. Rather than
// stranding every stock change in the queue if the app is deployed ahead of the
// migration, fall back to the old absolute write and say so once. This keeps the
// rollout order-independent; the moment the function exists the atomic path is
// used and the race is closed. The fallback still has the lost-update flaw, so
// it is a bridge, not a permanent answer.
let warnedMissingFn = false;
function isMissingFunction(error) {
  const code = error?.code || '';
  const message = String(error?.message || '');
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    /could not find the function|does not exist/i.test(message)
  );
}

async function legacyStockWrite(name, stock) {
  const { error } = await supabase
    .from('menu_items')
    .update({ stock: Math.max(0, Number(stock) || 0) })
    .eq('name', name);
  if (error) throw error;
}

async function movementWithFallback(name, delta) {
  const { data, error } = await supabase.rpc('apply_stock_movement', {
    p_name: name,
    p_delta: delta,
  });
  if (error) {
    if (!isMissingFunction(error)) throw error;
    if (!warnedMissingFn) {
      warnedMissingFn = true;
      console.warn(
        '[sync] apply_stock_movement is missing - apply supabase/migrations/0003_atomic_stock.sql. ' +
          'Falling back to a non-atomic stock write, so two registers can oversell until it is applied.'
      );
    }
    const { data: row, error: readError } = await supabase
      .from('menu_items')
      .select('stock')
      .eq('name', name)
      .maybeSingle();
    if (readError) throw readError;
    const next = Math.max(0, (Number(row?.stock) || 0) + delta);
    await legacyStockWrite(name, next);
    return { item_name: name, stock: next, shortfall: 0 };
  }
  return Array.isArray(data) ? data[0] : data;
}

// Stock movements go through the database function rather than an upsert, so
// two registers cannot both write their own idea of the remaining stock.
async function dispatchStock(op) {
  const row = op.payload || {};
  const name = String(row.name || '');
  if (!name) {
    return;
  }
  const qty = Math.max(1, Number(row.qty) || 1);
  const delta = op.action === 'increment' ? qty : -qty;
  const result = await movementWithFallback(name, delta);
  const shortfall = Number(result?.shortfall) || 0;
  if (shortfall > 0) {
    // Another register sold this stock first. The sale is real — the money
    // changed hands — so it is recorded either way, but the count is now known
    // to be wrong and someone has to recount.
    notifyStockShortfall({ name, shortfall, stock: Number(result?.stock) || 0 });
  }
}

async function dispatchSettings(op) {
  const row = op.payload || {};
  const { error } = await supabase
    .from('settings')
    .upsert({ key: row.key, value: row.value ?? '' }, { onConflict: 'key' });
  if (error) throw error;
}

async function dispatchCustomers(op) {
  if (op.action === 'delete') {
    const { error } = await supabase.from('customers').delete().eq('name', op.name);
    if (error) throw error;
    return;
  }
  const row = op.payload || {};
  const { error } = await supabase.from('customers').upsert(
    {
      name: row.name,
      phone: row.phone || '',
      email: row.email || '',
      visits: Number(row.visits) || 0,
      total_spent: round2(Number(row.total_spent) || 0),
      tier: row.tier || 'Bronze',
    },
    { onConflict: 'name' }
  );
  if (error) throw error;
}

// A manager typing a real count into the menu editor means "there are exactly
// this many", which is an absolute set rather than a movement.
async function dispatchStockSet(op) {
  const row = op.payload || {};
  const name = String(row.name || '');
  if (!name) {
    return;
  }
  const value = Math.max(0, Number(row.stock) || 0);
  const { error } = await supabase.rpc('set_menu_item_stock', {
    p_name: name,
    p_value: value,
  });
  if (error) {
    if (!isMissingFunction(error)) throw error;
    await legacyStockWrite(name, value);
    return;
  }
}

const DISPATCHERS = {
  orders: dispatchOrder,
  menu: dispatchMenu,
  stock: dispatchStock,
  stockSet: dispatchStockSet,
  customers: dispatchCustomers,
  settings: dispatchSettings,
};

// Replay the queue. Failed ops stay queued (they don't block later,
// unrelated ops — independent tables/rows don't depend on each other).
// Returns the number of ops successfully sent.
export async function flushQueue() {
  if (!isSupabaseConfigured || !supabase) {
    return 0;
  }
  const queue = readQueue();
  if (!queue.length) {
    return 0;
  }
  const remaining = [];
  let sent = 0;
  for (const op of queue) {
    const dispatcher = DISPATCHERS[op.table];
    try {
      if (dispatcher) {
        await dispatcher(op);
        sent += 1;
        continue;
      }
    } catch (e) {
      // keep it queued and try again on the next sync pass
    }
    remaining.push(op);
  }
  writeQueue(remaining);
  return sent;
}