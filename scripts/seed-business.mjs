// Seeds the remaining business data (customers, settings, orders + items)
// into Supabase using an admin credential. Idempotent — safe to re-run.
//
//   $env:SUPABASE_URL="https://xxxx.supabase.co"
//   $env:SUPABASE_SECRET_KEY="sb_secret_..."        (new key style)
//   # or the legacy form: $env:SUPABASE_SERVICE_ROLE_KEY="eyJ...service_role..."
//   node scripts/seed-business.mjs

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

const customers = [
  ['Walk-in Customer', 1, 704.0, 'Bronze'],
  ['Maria Santos', 1, 2266.0, 'Bronze'],
  ['John Reyes', 1, 1485.0, 'Bronze'],
  ['Ana Cruz', 1, 2255.0, 'Bronze'],
  ['Emma Cruz', 1, 0.0, 'Bronze'],
  ['Paolo Garcia', 1, 913.0, 'Bronze'],
  ['Liza Mendoza', 1, 1320.0, 'Bronze'],
  ['Carl Dizon', 1, 1397.0, 'Bronze'],
  ['Diego Lopez', 1, 0.0, 'Bronze'],
  ['Nina Bautista', 1, 902.0, 'Bronze'],
  ['Marco Villanueva', 1, 1694.0, 'Bronze'],
  ['Sofia Ramos', 1, 1562.0, 'Bronze'],
  ['Adrian Santos', 1, 1232.0, 'Bronze'],
  ['Kayla Torres', 1, 792.0, 'Bronze'],
  ['Ramon Aguilar', 1, 1892.0, 'Bronze'],
];

const settings = [
  ['pos_restaurant_name', 'Maison de Luxe'],
  ['pos_restaurant_contact', ''],
  ['pos_restaurant_address', ''],
];

// [id, customer, type, sub, discount, label, tax, total, payment, status, cashier, minutesAgo, items[[name,qty,price],...]]
const orders = [
  [1, 'Ramon Aguilar', 'Delivery', 1720, 0, '', 172, 1892, 'Credit Card', 'Completed', 'Main Cashier', 38 * 1440 + 50, [['Ratatouille', 1, 610], ['Herb Roasted Chicken', 1, 720], ['Tiramisu', 1, 390]]],
  [2, 'Kayla Torres', 'Dine-in', 720, 0, '', 72, 792, 'Maya', 'Completed', 'Main Cashier', 27 * 1440 + 15, [['Avocado Toast', 1, 460], ['Hot Chocolate', 1, 260]]],
  [3, 'Adrian Santos', 'Takeout', 1120, 0, '', 112, 1232, 'Cash Payout', 'Completed', 'Main Cashier', 18 * 1440 + 60, [['Kimchi Jigae', 1, 520], ['Garlic Rice', 2, 300]]],
  [4, 'Sofia Ramos', 'Dine-in', 1420, 0, '', 142, 1562, 'Paylater', 'Completed', 'Main Cashier', 13 * 1440 + 30, [['Grilled Salmon Plate', 1, 680], ['Tomato Basil Soup', 1, 380], ['Mango Panna Cotta', 1, 360]]],
  [5, 'Marco Villanueva', 'Delivery', 1540, 0, '', 154, 1694, 'Credit Card', 'Completed', 'Main Cashier', 9 * 1440 + 45, [['Beef Teriyaki Bowl', 2, 595], ['Miso Soup', 1, 350]]],
  [6, 'Nina Bautista', 'Dine-in', 820, 0, '', 82, 902, 'Cash Payout', 'Completed', 'Main Cashier', 6 * 1440 + 10, [['Chicken Caesar Wrap', 1, 540], ['Coleslaw Cup', 1, 280]]],
  [7, 'Diego Lopez', 'Takeout', 1260, 0, '', 126, 1386, 'Cash Payout', 'Cancelled', 'Main Cashier', 5 * 1440 + 90, [['Fish and Chips', 1, 980], ['Lemon Mocktail', 1, 280]]],
  [8, 'Carl Dizon', 'Dine-in', 1270, 0, '', 127, 1397, 'GCash', 'Completed', 'Main Cashier', 4 * 1440 + 40, [['Seafood Paella', 1, 890], ['Creme Brulee', 1, 380]]],
  [9, 'Liza Mendoza', 'Dine-in', 1200, 0, '', 120, 1320, 'Credit Card', 'Completed', 'Main Cashier', 3 * 1440 + 15, [['Spicy Fried Chicken', 1, 620], ['Garlic Rice', 1, 300], ['Lemon Mocktail', 1, 280]]],
  [10, 'Paolo Garcia', 'Dine-in', 830, 0, '', 83, 913, 'Cash Payout', 'Completed', 'Main Cashier', 2 * 1440 + 70, [['Eggs Benedict', 1, 520], ['Fresh Mango Shake', 1, 310]]],
  [11, 'Emma Cruz', 'Takeout', 730, 0, '', 73, 803, 'Paylater', 'Pending', 'Main Cashier', 2 * 1440 + 30, [['Breakfast Burrito', 1, 550], ['House Iced Tea', 1, 180]]],
  [12, 'Ana Cruz', 'Dine-in', 2050, 0, '', 205, 2255, 'Credit Card', 'Completed', 'Main Cashier', 1 * 1440 + 20, [['Lamb Chops', 1, 1280], ['French Onion Soup', 1, 420], ['Chocolate Mousse', 1, 350]]],
  [13, 'John Reyes', 'Takeout', 1350, 0, '', 135, 1485, 'Paylater', 'Completed', 'Main Cashier', 250, [['Pasta Bolognese', 2, 585], ['House Iced Tea', 1, 180]]],
  [14, 'Maria Santos', 'Dine-in', 2060, 0, '', 206, 2266, 'Cash Payout', 'Completed', 'Main Cashier', 125, [['Grilled Steak', 1, 1450], ['Mashed Potatoes', 1, 320], ['Iced Matcha Latte', 1, 290]]],
  [15, 'Walk-in Customer', 'Dine-in', 640, 0, '', 64, 704, 'Credit Card', 'Completed', 'Main Cashier', 40, [['Truffle Parmesan Fries', 1, 420], ['Iced Americano', 1, 220]]],
];

const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();

// 1) Customers
const { error: custErr } = await supabase
  .from('customers')
  .upsert(
    customers.map(([name, visits, total_spent, tier]) => ({ name, visits, total_spent, tier })),
    { onConflict: 'name' }
  );
if (custErr) {
  console.error('Customers failed:', custErr.message);
} else {
  console.log(`OK  customers: ${customers.length}`);
}

// 2) Settings
const { error: setErr } = await supabase
  .from('settings')
  .upsert(settings.map(([key, value]) => ({ key, value })), { onConflict: 'key' });
if (setErr) {
  console.error('Settings failed:', setErr.message);
} else {
  console.log(`OK  settings: ${settings.length}`);
}

// 3) Orders (+ items)
const { error: orderErr } = await supabase
  .from('orders')
  .upsert(
    orders.map(([id, customer_name, order_type, sub_total, discount_amount, discount_label, tax_amount, total_amount, payment_method, order_status, cashier_name, m, items]) => ({
      id,
      customer_name,
      order_type,
      sub_total,
      discount_amount,
      discount_label,
      tax_amount,
      total_amount,
      payment_method,
      order_status,
      cashier_name,
      created_at: minutesAgo(m),
    })),
    { onConflict: 'id' }
  );
if (orderErr) {
  console.error('Orders failed:', orderErr.message);
  process.exit(1);
}
console.log(`OK  orders: ${orders.length}`);

// 4) Order items — replace existing rows for these orders so re-runs stay clean.
const ids = orders.map(([id]) => id);
const { error: delErr } = await supabase
  .from('order_items')
  .delete()
  .in('order_id', ids);
if (delErr) {
  console.error('Order items cleanup failed:', delErr.message);
  process.exit(1);
}

const itemRows = [];
for (const [id, , , , , , , , , , , , items] of orders) {
  for (const [name, quantity, unit_price] of items) {
    itemRows.push({ order_id: id, name, quantity, unit_price, subtotal: quantity * unit_price });
  }
}
const { error: itemErr } = await supabase.from('order_items').insert(itemRows);
if (itemErr) {
  console.error('Order items failed:', itemErr.message);
  process.exit(1);
}
console.log(`OK  order_items: ${itemRows.length}`);

console.log('\nDatabase seed complete.');
process.exit(0);