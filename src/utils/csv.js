// Client-side CSV export of orders with the same columns shown in the
// Orders table.
//
// Two layers on purpose:
//   buildOrdersCsv()  — pure, turns orders into the CSV text. No DOM, so it is
//                       unit-testable in Node and reusable if the export ever
//                       moves server-side.
//   exportOrdersCsv() — the browser download wrapper around it.
//
// `label` names the window the rows cover (e.g. 'last14d'); it is appended to
// the filename so an exported file always says which period it contains.
// Callers that filter must pass the filtered list, not the full one — a
// manager who selects a range and then exports expects that range.

import { formatDateOnly } from './format.js';

const HEADER = ['ID', 'Date/Time', 'Customer', 'Status', 'Payment', 'Total', 'Cashier', 'Items'];

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

function orderRow(o) {
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
}

// Build the CSV text for `orders`. Leading BOM so Excel opens UTF-8 accented
// names correctly. Header row is always present, even for an empty list, so a
// zero-order export is still a valid, openable file.
export function buildOrdersCsv(orders) {
  return '\uFEFF' + toCsv([HEADER, ...orders.map(orderRow)]);
}

// Trigger the download. Returns the number of order rows written (not
// counting the header) so the caller can confirm the scope of what was saved.
export function exportOrdersCsv(orders, { label = '' } = {}) {
  const blob = new Blob([buildOrdersCsv(orders)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const scope = label ? `_${label}` : '';
  link.download = `orders_export_${formatDateOnly(new Date())}${scope}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return orders.length;
}
