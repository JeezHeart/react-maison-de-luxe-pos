// Date-range helpers shared by the manager overview and the reports page.
//
// Both surfaces need the same thing: turn a range selection into inclusive
// Y-m-d bounds, then narrow the order list to it. Keeping that logic here
// means the overview and the reports can never disagree about what a range
// means — they did once, and the overview silently reported all-time numbers
// next to a ranged chart.

import { formatDateOnly } from './format.js';

const DAY_MS = 86400000;

// Inclusive bounds for a named report range. 'all' yields empty strings,
// which callers treat as "do not filter".
export function rangeBounds(range) {
  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');

  if (range === 'today') {
    const s = formatDateOnly(today);
    return { start: s, end: s };
  }
  if (range === 'week') {
    const start = new Date(today.getTime() - 6 * DAY_MS);
    return { start: formatDateOnly(start), end: formatDateOnly(today) };
  }
  if (range === 'month') {
    return {
      start: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`,
      end: formatDateOnly(today),
    };
  }
  return { start: '', end: '' };
}

// Inclusive bounds for a trailing window of `days` days, today included.
// days=7 yields the same window as rangeBounds('week').
export function lastNDaysBounds(days) {
  const n = Math.max(1, Math.floor(Number(days) || 1));
  const end = new Date();
  const start = new Date(end.getTime() - (n - 1) * DAY_MS);
  return { start: formatDateOnly(start), end: formatDateOnly(end) };
}

// Narrow orders to a bounds pair. Empty bounds pass everything through.
// Y-m-d strings compare correctly as plain strings, so no Date parsing (and
// no timezone surprises) is needed here.
export function filterByBounds(orders, bounds) {
  const { start, end } = bounds || {};
  if (!start || !end) return orders;
  return orders.filter((o) => {
    const day = String(o.created_at || '').slice(0, 10);
    return day >= start && day <= end;
  });
}
