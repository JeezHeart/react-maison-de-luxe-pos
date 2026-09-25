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
//   settings:
//     { table:'settings', action:'upsert', payload: { key, value } }

import { supabase, isSupabaseConfigured } from './supabase.js';
import { round2 } from '../utils/format.js';

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
}

// ---------------------------------------------------------------------------
// Dispatch helpers — one DB write per queued op.
// ---------------------------------------------------------------------------

function toRemoteDate(value) {
  const date = value instanceof Date ? value : new Date(value);
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
  const { error } = await supabase.from('menu_items').upsert(
    {
      name: item.name,
      category: item.category,
      description: item.description || '',
      price: round2(Number(item.price) || 0),
      stock: Number(item.stock) || 0,
    },
    { onConflict: 'name' }
  );
  if (error) throw error;
}

async function dispatchSettings(op) {
  const row = op.payload || {};
  const { error } = await supabase
    .from('settings')
    .upsert({ key: row.key, value: row.value ?? '' }, { onConflict: 'key' });
  if (error) throw error;
}

const DISPATCHERS = {
  orders: dispatchOrder,
  menu: dispatchMenu,
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