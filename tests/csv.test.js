import { describe, it, expect } from 'vitest';
import { buildOrdersCsv } from '../src/utils/csv.js';

// Split the CSV text into rows, dropping the BOM and any trailing empty line.
function rows(csv) {
  return csv
    .replace(/^\uFEFF/, '')
    .split('\r\n')
    .filter((r) => r.length > 0);
}

const ORDER = {
  id: 7,
  created_at: '2026-09-20T10:30:00.000Z',
  customer_name: 'Ana Reyes',
  order_status: 'Completed',
  payment_method: 'GCash',
  total_amount: 1250.5,
  cashier_name: 'Main Cashier',
  items: [
    { name: 'Truffle Pasta', quantity: 2 },
    { name: 'Caesar Salad', quantity: 1 },
  ],
};

describe('buildOrdersCsv', () => {
  it('starts with a BOM so Excel reads UTF-8 names correctly', () => {
    expect(buildOrdersCsv([ORDER]).charCodeAt(0)).toBe(0xfeff);
  });

  it('emits the header row even with no orders', () => {
    expect(rows(buildOrdersCsv([]))).toEqual([
      'ID,Date/Time,Customer,Status,Payment,Total,Cashier,Items',
    ]);
  });

  it('emits one row per order, in the order given', () => {
    const out = rows(buildOrdersCsv([ORDER, { ...ORDER, id: 8 }]));
    expect(out).toHaveLength(3); // header + 2
    expect(out[1].startsWith('7,')).toBe(true);
    expect(out[2].startsWith('8,')).toBe(true);
  });

  it('summarises items as "name xqty", sorted, semicolon-separated', () => {
    const out = rows(buildOrdersCsv([ORDER]));
    // Caesar Salad sorts before Truffle Pasta.
    expect(out[1].endsWith('Caesar Salad x1; Truffle Pasta x2')).toBe(true);
  });

  it('leaves the Items cell empty when an order has no items', () => {
    const out = rows(buildOrdersCsv([{ ...ORDER, items: null }]));
    expect(out[1].endsWith(',')).toBe(true);
  });

  it('falls back to N/A when the order has no cashier name', () => {
    const out = rows(buildOrdersCsv([{ ...ORDER, cashier_name: null }]));
    expect(out[1]).toContain(',N/A,');
  });

  it('quotes cells containing a comma and doubles embedded quotes', () => {
    const out = rows(
      buildOrdersCsv([{ ...ORDER, customer_name: 'Reyes, Ana "JR"' }])
    );
    expect(out[1]).toContain('"Reyes, Ana ""JR"""');
  });

  it('quotes cells containing a newline', () => {
    const out = rows(buildOrdersCsv([{ ...ORDER, customer_name: 'line1\nline2' }]));
    expect(out[1]).toContain('"line1\nline2"');
  });

  it('writes empty cells for null/undefined values', () => {
    const out = rows(
      buildOrdersCsv([{ ...ORDER, customer_name: undefined, payment_method: null }])
    );
    // id, date, then an empty customer, then status, then an empty payment.
    expect(out[1]).toBe(
      '7,2026-09-20T10:30:00.000Z,,Completed,,1250.5,Main Cashier,Caesar Salad x1; Truffle Pasta x2'
    );
  });
});
