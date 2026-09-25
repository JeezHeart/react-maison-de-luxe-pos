// Client-side CSV export of orders with the same columns shown in the
// Orders table.

import { formatDateOnly } from './format.js';

function escapeCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCsv(rows) {
  return rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

export function exportOrdersCsv(orders) {
  const header = ['ID', 'Date/Time', 'Customer', 'Status', 'Payment', 'Total', 'Cashier', 'Items'];

  const rows = orders.map((o) => {
    const itemsSummary = o.items
      ? o.items
          .map((it) => `${it.name} x${it.quantity}`)
          .sort()
          .join('; ')
      : '';
    return [
      o.id,
      o.created_at,
      o.customer_name,
      o.order_status,
      o.payment_method,
      o.total_amount,
      o.cashier_name || 'N/A',
      itemsSummary,
    ];
  });

  const csv = '\uFEFF' + toCsv([header, ...rows]);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `orders_export_${formatDateOnly(new Date())}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}