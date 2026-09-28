// Demo history generator — realistic sample orders for presentations.
//
// WHY this exists: fresh installs start with only a handful of seed orders,
// so the sales trend / top sellers / payment mix charts look sparse during a
// professor demo. Managers can press "Load Demo Data" on the Overview to fill
// the charts with ~45 days of plausible orders in one click.
//
// IMPORTANT — demo data is *view-only* by design:
//   * stored under its OWN localStorage key (never enters the sync queue)
//   * never written to Supabase — the cloud stays 100% real
//   * merged into the Overview + Reports chart inputs only; the Orders ledger,
//     Receipts and Settings snapshots always show real data
//   * resettable with one click (clearDemoOrders)

import { formatDateTime, round2 } from '../utils/format.js';

const STORAGE_KEY = 'luxury_pos_demo_history';

// 16-digit id range, far away from real order ids (Date.now()*1000 + seq,
// so ~1.7e15). A 5e15 base can never collide with a live order.
const DEMO_ID_BASE = 5000000000000000;

const FALLBACK_CUSTOMERS = [
  'Walk-in Customer',
  'Maria Santos',
  'John Reyes',
  'Ana Cruz',
  'Emma Cruz',
  'Paolo Garcia',
  'Liza Mendoza',
  'Carl Dizon',
  'Diego Lopez',
  'Nina Bautista',
  'Marco Villanueva',
  'Sofia Ramos',
  'Adrian Santos',
  'Kayla Torres',
  'Ramon Aguilar',
];

const CASHIERS = ['Miguel Santos', 'Sofia Ramos', 'Diego Lopez', 'Elena Cruz'];

// Weighted arrays: entries repeated more often win more rolls.
const PAYMENTS = [
  'GCash', 'GCash', 'GCash',
  'Credit Card', 'Credit Card',
  'Cash Payout', 'Cash Payout',
  'Maya', 'Paylater',
];
const ORDER_TYPES = ['Dine-in', 'Dine-in', 'Dine-in', 'Takeout', 'Delivery'];
const DISCOUNT_LABELS = [null, null, null, 'Senior & PWD (20%)', 'Fixed Amount (₱)'];
const TENDER_BUMP = [1, 5, 10, 20, 50, 100, 200, 500];

export function loadDemoOrders() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveDemoOrders(orders) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch (e) {
    // storage unavailable — demo data is best-effort only
  }
}

export function clearDemoOrders() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    // ignore
  }
}

export function hasDemoOrders() {
  return loadDemoOrders().length > 0;
}

// Deterministic PRNG (mulberry32) — the same seed always yields the same demo
// set, so a demo can be reproduced verbatim and tests stay stable.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hour of day weighted toward lunch (11-13) and dinner (17-21) peaks.
function pickHour(rand) {
  const r = rand();
  if (r < 0.25) return 11 + Math.floor(rand() * 3);
  if (r < 0.55) return 17 + Math.floor(rand() * 5);
  return 8 + Math.floor(rand() * 11);
}

function buildLineItems(rand, menuItems) {
  const count = 1 + Math.floor(rand() * 3); // 1-3 lines per order
  const lines = [];
  const seen = new Set();
  for (let i = 0; i < count; i += 1) {
    const item =
      menuItems && menuItems.length
        ? menuItems[Math.floor(rand() * menuItems.length)]
        : { name: `Sample Item ${i + 1}`, price: 120 + Math.floor(rand() * 180) };
    if (seen.has(item.name)) {
      continue;
    }
    seen.add(item.name);
    const qty = 1 + Math.floor(rand() * 3);
    const unitPrice = round2(Number(item.price) || 0) || 1;
    lines.push({
      name: item.name,
      quantity: qty,
      unit_price: unitPrice,
      subtotal: round2(qty * unitPrice),
    });
  }
  if (!lines.length) {
    lines.push({ name: 'House Iced Tea', quantity: 1, unit_price: 80, subtotal: 80 });
  }
  return lines;
}

// Build a dense, believable order history: weekends louder than weekdays,
// lunch/dinner peaks, realistic payment mix, a few cancelled orders (so the
// lost-revenue card has content) and cash orders with change.
export function generateDemoOrders(options = {}) {
  const {
    days = 45,
    menuItems = [],
    customers = FALLBACK_CUSTOMERS,
    seed = 20260928,
    now = Date.now(),
  } = options;
  const rand = mulberry32(seed);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const usableCustomers =
    Array.isArray(customers) && customers.length ? customers : FALLBACK_CUSTOMERS;

  const orders = [];
  let id = DEMO_ID_BASE;

  for (let d = days - 1; d >= 0; d -= 1) {
    const day = new Date(now - d * 86400000);
    const dow = day.getDay();
    const weekend = dow === 0 || dow === 6;
    const count = Math.max(2, Math.round((weekend ? 16 : 10) + rand() * 8));

    for (let i = 0; i < count; i += 1) {
      const at = new Date(day.getTime());
      at.setHours(pickHour(rand), Math.floor(rand() * 60), Math.floor(rand() * 30), 0);

      const items = buildLineItems(rand, menuItems);
      const sub = round2(items.reduce((sum, it) => sum + it.subtotal, 0));
      const tax = round2(sub * 0.1);
      const gross = sub + tax;

      let discount = 0;
      let discountLabel = '';
      const label = DISCOUNT_LABELS[Math.floor(rand() * DISCOUNT_LABELS.length)];
      if (label === 'Senior & PWD (20%)') {
        discount = gross * 0.2;
        discountLabel = label;
      } else if (label === 'Fixed Amount (₱)') {
        discount = gross * (0.05 + rand() * 0.1);
        discountLabel = label;
      }
      discount = Math.min(round2(discount), gross);
      const total = round2(gross - discount);

      const payment = pick(PAYMENTS);
      const orderType = pick(ORDER_TYPES);
      const roll = rand();
      const orderStatus =
        roll < 0.9 ? 'Completed' : roll < 0.95 ? 'Pending' : 'Cancelled';

      id += 1;
      const order = {
        id,
        customer_name: rand() < 0.75 ? pick(usableCustomers) : 'Walk-in Customer',
        order_type: orderType,
        sub_total: sub,
        discount_amount: discount,
        discount_label: discountLabel,
        tax_amount: tax,
        total_amount: total,
        payment_method: payment,
        order_status: orderStatus,
        created_at: formatDateTime(at),
        cashier_name: pick(CASHIERS),
        items,
      };

      if (payment === 'Cash Payout' && orderStatus !== 'Cancelled') {
        const tendered = round2(total + pick(TENDER_BUMP));
        if (tendered >= total) {
          order.cash_tendered = tendered;
          order.change_amount = round2(tendered - total);
        }
      }

      orders.push(order);
    }
  }

  orders.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return orders;
}