import { create } from 'zustand';
import { useMenuStore } from './menuStore.js';
import { formatDateTime, round2 } from '../utils/format.js';
import { useAuthStore } from './authStore.js';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';
import { enqueue } from '../lib/sync.js';

export const STORAGE_KEY = 'luxury_pos_orders';

// Single cashier account used across all orders.
export const CASHIER_NAME = 'Main Cashier';
export const USER_COUNT = 1;

// ---------------------------------------------------------------------------
// Seed orders — mock history so Orders / Reports / Recent Orders have content
// on first run. Persisted to browser localStorage.
// ---------------------------------------------------------------------------
// [daysAgo, extraMinutes, customer, payment, status, [[itemName, qty], ...], orderType]
const SEED_DEFS = [
  [0, 40, 'Walk-in Customer', 'Credit Card', 'Completed', [['Truffle Parmesan Fries', 1], ['Iced Americano', 1]], 'Dine-in'],
  [0, 125, 'Maria Santos', 'Cash Payout', 'Completed', [['Grilled Steak', 1], ['Mashed Potatoes', 1], ['Iced Matcha Latte', 1]], 'Dine-in'],
  [0, 250, 'John Reyes', 'Paylater', 'Completed', [['Pasta Bolognese', 2], ['House Iced Tea', 1]], 'Takeout'],
  [1, 20, 'Ana Cruz', 'Credit Card', 'Completed', [['Lamb Chops', 1], ['French Onion Soup', 1], ['Chocolate Mousse', 1]], 'Dine-in'],
  [2, 30, 'Emma Cruz', 'Paylater', 'Pending', [['Breakfast Burrito', 1], ['House Iced Tea', 1]], 'Takeout'],
  [2, 70, 'Paolo Garcia', 'Cash Payout', 'Completed', [['Eggs Benedict', 1], ['Fresh Mango Shake', 1]], 'Dine-in'],
  [3, 15, 'Liza Mendoza', 'Credit Card', 'Completed', [['Spicy Fried Chicken', 1], ['Garlic Rice', 1], ['Lemon Mocktail', 1]], 'Dine-in'],
  [4, 40, 'Carl Dizon', 'GCash', 'Completed', [['Seafood Paella', 1], ['Creme Brulee', 1]], 'Dine-in'],
  [5, 90, 'Diego Lopez', 'Cash Payout', 'Cancelled', [['Fish and Chips', 1], ['Lemon Mocktail', 1]], 'Takeout'],
  [6, 10, 'Nina Bautista', 'Cash Payout', 'Completed', [['Chicken Caesar Wrap', 1], ['Coleslaw Cup', 1]], 'Dine-in'],
  [9, 45, 'Marco Villanueva', 'Credit Card', 'Completed', [['Beef Teriyaki Bowl', 2], ['Miso Soup', 1]], 'Delivery'],
  [13, 30, 'Sofia Ramos', 'Paylater', 'Completed', [['Grilled Salmon Plate', 1], ['Tomato Basil Soup', 1], ['Mango Panna Cotta', 1]], 'Dine-in'],
  [18, 60, 'Adrian Santos', 'Cash Payout', 'Completed', [['Kimchi Jigae', 1], ['Garlic Rice', 2]], 'Takeout'],
  [27, 15, 'Kayla Torres', 'Maya', 'Completed', [['Avocado Toast', 1], ['Hot Chocolate', 1]], 'Dine-in'],
  [38, 50, 'Ramon Aguilar', 'Credit Card', 'Completed', [['Ratatouille', 1], ['Herb Roasted Chicken', 1], ['Tiramisu', 1]], 'Delivery'],
];

const nameToItem = new Map(useMenuStore.getState().items.map((m) => [m.name, m]));

function createSeedOrders() {
  const now = Date.now();
  const built = SEED_DEFS.map((def) => {
    const [daysAgo, extraMinutes, customerName, paymentMethod, status, lines, orderType] = def;
    const createdAt = new Date(now - daysAgo * 86400000 - extraMinutes * 60000);

    const items = lines.map(([name, qty]) => {
      const menuItem = nameToItem.get(name);
      const unitPrice = menuItem ? menuItem.price : 100;
      return {
        name,
        quantity: qty,
        unit_price: unitPrice,
        subtotal: round2(qty * unitPrice),
      };
    });

    const sub = items.reduce((sum, i) => sum + i.subtotal, 0);

    return {
      customer_name: customerName,
      order_type: orderType || 'Dine-in',
      sub_total: round2(sub),
      discount_amount: 0,
      discount_label: '',
      tax_amount: round2(sub * 0.1),
      total_amount: round2(sub * 1.1),
      payment_method: paymentMethod,
      order_status: status,
      created_at: formatDateTime(createdAt),
      cashier_name: CASHIER_NAME,
      items,
    };
  });

  // Oldest first, so IDs increment over time like an auto-increment column.
  built.sort((a, b) => a.created_at.localeCompare(b.created_at));
  built.forEach((order, index) => {
    order.id = index + 1;
  });

  // Newest first for display.
  return built.sort((a, b) => b.id - a.id);
}

function loadOrders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Backfill fields added after older orders were saved:
        // order type and the structured subtotal/tax breakdown.
        return parsed.map((o) => ({
          ...o,
          order_type: o.order_type || 'Dine-in',
          sub_total: o.sub_total != null ? o.sub_total : null,
          discount_amount: Number(o.discount_amount) || 0,
          discount_label: o.discount_label || '',
          tax_amount: o.tax_amount != null ? o.tax_amount : null,
          cash_tendered: o.cash_tendered != null ? o.cash_tendered : null,
          change_amount: o.change_amount != null ? o.change_amount : null,
        }));
      }
    }
  } catch (e) {
    // ignore corrupt storage and re-seed below
  }
  const seeds = createSeedOrders();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeds));
  } catch (e) {
    // storage unavailable; keep seeds in memory only
  }
  return seeds;
}

function persist(orders) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch (e) {
    // ignore quota / availability errors
  }
}

export const useOrderStore = create((set, get) => ({
  orders: loadOrders(),

  // Derived order row values. New orders store a full breakdown
  // (subtotal / discount / tax); older orders without it fall back
  // to backing the tax out of the grand total (sub = total / 1.10).
  getOrderDetails(order) {
    const grandTotal = Number(order.total_amount) || 0;
    const hasBreakdown = order.sub_total != null && order.tax_amount != null;
    const subTotal = hasBreakdown
      ? round2(Number(order.sub_total))
      : round2(grandTotal / 1.1);
    const discountAmount = round2(Number(order.discount_amount) || 0);
    const taxTotal = hasBreakdown
      ? round2(Number(order.tax_amount))
      : round2(grandTotal - subTotal);
    const totalQty = (order.items || []).reduce((sum, i) => sum + i.quantity, 0);
    const itemsSummary = (order.items || [])
      .map((i) => i.name)
      .sort()
      .join(', ');
    return {
      subTotal,
      discountAmount,
      discountLabel: order.discount_label || '',
      taxTotal,
      grandTotal,
      totalQty,
      itemsSummary,
      orderType: order.order_type || 'Dine-in',
      cashTendered: order.cash_tendered != null ? Number(order.cash_tendered) : null,
      changeAmount: order.change_amount != null ? Number(order.change_amount) : null,
    };
  },

  placeOrder({
    customerName,
    paymentMethod,
    orderType,
    items,
    subTotal,
    discountLabel = '',
    discountAmount = 0,
    taxAmount,
    totalAmount,
    cashTendered = null,
    changeAmount = null,
  }) {
    const orders = [...get().orders];
    const nextId = orders.reduce((max, o) => Math.max(max, o.id), 0) + 1;
    const currentUser = useAuthStore.getState().currentUser;
    const order = {
      id: nextId,
      customer_name: customerName || 'Walk-in Customer',
      order_type: orderType || 'Dine-in',
      sub_total: round2(Number(subTotal) || 0),
      discount_amount: round2(Number(discountAmount) || 0),
      discount_label: discountLabel || '',
      tax_amount: round2(Number(taxAmount) || 0),
      cash_tendered: cashTendered != null ? round2(Number(cashTendered)) : null,
      change_amount: changeAmount != null ? round2(Number(changeAmount)) : null,
      total_amount: round2(totalAmount),
      payment_method: paymentMethod,
      order_status: 'Completed',
      created_at: formatDateTime(new Date()),
      cashier_name: (currentUser && currentUser.name) || CASHIER_NAME,
      items: items.map((i) => ({
        name: i.name,
        quantity: i.qty,
        unit_price: round2(i.price),
        subtotal: round2(i.qty * i.price),
      })),
    };
    const next = [order, ...orders];
    set({ orders: next });
    persist(next);
    // Queue the order for the shared database (uploaded when online).
    enqueue({ table: 'orders', action: 'insert', payload: order });
    // Auto-deduct stock for the quantities just sold.
    for (const line of items) {
      useMenuStore.getState().reduceStock(line.name, line.qty);
    }
    return order;
  },

  deleteOrder: (id) => {
    const next = get().orders.filter((o) => o.id !== id);
    set({ orders: next });
    persist(next);
    enqueue({ table: 'orders', action: 'delete', id });
  },

  // Move an order through the status pipeline (kanban board).
  updateOrderStatus: (id, status) => {
    const next = get().orders.map((o) =>
      o.id === id ? { ...o, order_status: status } : o
    );
    set({ orders: next });
    persist(next);
    enqueue({ table: 'orders', action: 'update', id, payload: { order_status: status } });
  },

  // Re-insert a previously deleted order (Undo delete). Orders are kept
  // sorted newest-first by id to match the display convention.
  restoreOrder: (order) => {
    if (!order || get().orders.some((o) => o.id === order.id)) {
      return;
    }
    const next = [...get().orders, order].sort((a, b) => b.id - a.id);
    set({ orders: next });
    persist(next);
    enqueue({ table: 'orders', action: 'insert', payload: order });
  },

  getOrder: (id) => get().orders.find((o) => o.id === id),

  // Pull the shared order history into this device. Remote wins; local
  // rows that aren't in the database are uploaded first by the controller.
  syncFromRemote: async () => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }
    const { data: remoteOrders, error } = await supabase.from('orders').select('*');
    if (error) {
      throw error;
    }
    if (!remoteOrders || remoteOrders.length === 0) {
      return;
    }
    const { data: remoteItems } = await supabase.from('order_items').select('*');
    const itemsByOrder = new Map();
    for (const row of remoteItems || []) {
      if (!itemsByOrder.has(row.order_id)) {
        itemsByOrder.set(row.order_id, []);
      }
      itemsByOrder.get(row.order_id).push({
        name: row.name,
        quantity: row.quantity,
        unit_price: Number(row.unit_price),
        subtotal: Number(row.subtotal),
      });
    }
    const merged = remoteOrders
      .map((o) => ({
        id: o.id,
        customer_name: o.customer_name,
        order_type: o.order_type || 'Dine-in',
        sub_total: o.sub_total != null ? Number(o.sub_total) : null,
        discount_amount: Number(o.discount_amount) || 0,
        discount_label: o.discount_label || '',
        tax_amount: o.tax_amount != null ? Number(o.tax_amount) : null,
        cash_tendered: o.cash_tendered != null ? Number(o.cash_tendered) : null,
        change_amount: o.change_amount != null ? Number(o.change_amount) : null,
        total_amount: Number(o.total_amount) || 0,
        payment_method: o.payment_method,
        order_status: o.order_status || 'Completed',
        created_at: formatDateTime(new Date(o.created_at)),
        cashier_name: o.cashier_name || '',
        items: itemsByOrder.get(o.id) || [],
      }))
      .sort((a, b) => b.id - a.id);
    set({ orders: merged });
    persist(merged);
  },
}));