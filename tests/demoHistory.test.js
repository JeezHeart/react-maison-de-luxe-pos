import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadDemoOrders,
  saveDemoOrders,
  clearDemoOrders,
  hasDemoOrders,
  generateDemoOrders,
  mulberry32,
} from '../src/lib/demoHistory.js';
import { formatDateOnly, round2 } from '../src/utils/format.js';

const MENU = [
  { name: 'Grilled Steak', price: 450 },
  { name: 'Truffle Parmesan Fries', price: 240 },
  { name: 'Iced Americano', price: 130 },
  { name: 'Chocolate Mousse', price: 190 },
  { name: 'Breakfast Burrito', price: 260 },
];

const CUSTOMERS = ['Maria Santos', 'John Reyes', 'Ana Cruz'];

function makeOrder(o) {
  return {
    id: o.id,
    customer_name: o.customer_name,
    order_type: o.order_type,
    sub_total: o.sub_total,
    discount_amount: o.discount_amount,
    discount_label: o.discount_label,
    tax_amount: o.tax_amount,
    total_amount: o.total_amount,
    payment_method: o.payment_method,
    order_status: o.order_status,
    created_at: o.created_at,
    cashier_name: o.cashier_name,
    items: o.items,
  };
}

describe('demoHistory generator', () => {
  const NOW = Date.UTC(2026, 8, 28, 12, 0, 0);

  it('is deterministic for the same seed', () => {
    const a = generateDemoOrders({ days: 10, menuItems: MENU, customers: CUSTOMERS, seed: 7, now: NOW });
    const b = generateDemoOrders({ days: 10, menuItems: MENU, customers: CUSTOMERS, seed: 7, now: NOW });
    expect(a.length).toBe(b.length);
    expect(a.map((o) => o.id)).toEqual(b.map((o) => o.id));
    expect(a.map((o) => o.created_at)).toEqual(b.map((o) => o.created_at));
    expect(a.map((o) => o.total_amount)).toEqual(b.map((o) => o.total_amount));
  });

  it('fills the requested window with a dense history', () => {
    const orders = generateDemoOrders({ days: 45, menuItems: MENU, customers: CUSTOMERS, seed: 1, now: NOW });
    expect(orders.length).toBeGreaterThan(200);
    // Day-range check (the same slice the report filters use) so the local
    // wall-clock rendering of the "now" instant can't shift the boundary.
    const earliestDay = formatDateOnly(new Date(NOW - 44 * 86400000));
    const latestDay = formatDateOnly(new Date(NOW));
    for (const o of orders) {
      const day = String(o.created_at || '').slice(0, 10);
      expect(day >= earliestDay).toBe(true);
      expect(day <= latestDay).toBe(true);
    }
  });

  it('produces collision-free ids on a distinct range', () => {
    const orders = generateDemoOrders({ days: 30, menuItems: MENU, customers: CUSTOMERS, seed: 2, now: NOW });
    const ids = new Set(orders.map((o) => o.id));
    expect(ids.size).toBe(orders.length);
    for (const id of ids) {
      expect(String(id)).toMatch(/^\d{16}$/);
      // Far from the live id space (real ids start ~1.7e15 epoch-based).
      expect(id).toBeGreaterThan(4000000000000000);
    }
  });

  it('keeps money math consistent on every order', () => {
    const orders = generateDemoOrders({ days: 15, menuItems: MENU, customers: CUSTOMERS, seed: 3, now: NOW });
    for (const o of orders) {
      const sub = round2((o.items || []).reduce((s, it) => s + Number(it.subtotal || 0), 0));
      expect(o.sub_total).toBe(sub);
      expect(o.tax_amount).toBe(round2(sub * 0.1));
      expect(o.discount_amount).toBeGreaterThanOrEqual(0);
      expect(o.discount_amount).toBeLessThanOrEqual(sub + o.tax_amount);
      expect(o.total_amount).toBe(round2(sub + o.tax_amount - o.discount_amount));
      // Items carry the name/qty/price/subtotal shape the stats expect.
      for (const it of o.items) {
        expect(typeof it.name).toBe('string');
        expect(Number(it.quantity)).toBeGreaterThan(0);
        expect(Number(it.unit_price)).toBeGreaterThan(0);
        expect(it.subtotal).toBe(round2(Number(it.quantity) * Number(it.unit_price)));
      }
    }
  });

  it('includes completed and cancelled orders (chart variety)', () => {
    const orders = generateDemoOrders({ days: 45, menuItems: MENU, customers: CUSTOMERS, seed: 4, now: NOW });
    const statuses = new Set(orders.map((o) => o.order_status));
    expect(statuses.has('Completed')).toBe(true);
    expect(statuses.has('Cancelled')).toBe(true);
  });

  it('round-trips through localStorage', () => {
    clearDemoOrders();
    expect(hasDemoOrders()).toBe(false);
    const orders = generateDemoOrders({ days: 7, menuItems: MENU, customers: CUSTOMERS, seed: 5, now: NOW });
    saveDemoOrders(orders);
    expect(hasDemoOrders()).toBe(true);
    const loaded = loadDemoOrders();
    expect(loaded.length).toBe(orders.length);
    expect(makeOrder(loaded[0])).toEqual(makeOrder(orders[0]));
    clearDemoOrders();
    expect(loadDemoOrders()).toEqual([]);
    expect(hasDemoOrders()).toBe(false);
  });

  it('tolerates missing menu items (fallback lines)', () => {
    const orders = generateDemoOrders({ days: 3, menuItems: [], customers: [], seed: 6, now: NOW });
    expect(orders.length).toBeGreaterThan(0);
    for (const o of orders) {
      expect(o.items.length).toBeGreaterThan(0);
      expect(o.sub_total).toBeGreaterThan(0);
    }
  });
});

describe('mulberry32', () => {
  it('returns deterministic values in [0, 1)', () => {
    const rand = mulberry32(12345);
    const first = rand();
    const again = mulberry32(12345);
    expect(again()).toBe(first);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(1);
    const rs = [rand(), rand(), rand()];
    expect(new Set(rs).size).toBe(3);
  });
});