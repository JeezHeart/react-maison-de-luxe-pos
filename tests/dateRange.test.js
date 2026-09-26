import { describe, it, expect } from 'vitest';
import { rangeBounds, lastNDaysBounds, filterByBounds } from '../src/utils/dateRange.js';
import { formatDateOnly } from '../src/utils/format.js';

const today = formatDateOnly(new Date());
const DAY_MS = 86400000;

function daysAgo(n) {
  return formatDateOnly(new Date(Date.now() - n * DAY_MS));
}

describe('rangeBounds', () => {
  it("'all' yields empty bounds so callers skip filtering", () => {
    expect(rangeBounds('all')).toEqual({ start: '', end: '' });
  });

  it("'today' collapses to a single day", () => {
    expect(rangeBounds('today')).toEqual({ start: today, end: today });
  });

  it("'week' is an inclusive 7-day window ending today", () => {
    expect(rangeBounds('week')).toEqual({ start: daysAgo(6), end: today });
  });

  it("'month' runs from the first of the month to today", () => {
    const d = new Date();
    const first = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    expect(rangeBounds('month')).toEqual({ start: first, end: today });
  });
});

describe('lastNDaysBounds', () => {
  it('matches rangeBounds("week") for a 7-day window', () => {
    expect(lastNDaysBounds(7)).toEqual(rangeBounds('week'));
  });

  it('treats 1 day as today only', () => {
    expect(lastNDaysBounds(1)).toEqual({ start: today, end: today });
  });

  it('spans the full inclusive window for 14 days', () => {
    expect(lastNDaysBounds(14)).toEqual({ start: daysAgo(13), end: today });
  });

  it('clamps nonsense input to a single day instead of an empty window', () => {
    expect(lastNDaysBounds(0)).toEqual({ start: today, end: today });
    expect(lastNDaysBounds(-5)).toEqual({ start: today, end: today });
    expect(lastNDaysBounds(NaN)).toEqual({ start: today, end: today });
  });
});

describe('filterByBounds', () => {
  const orders = [
    { id: 1, created_at: `${daysAgo(10)} 09:00:00` },
    { id: 2, created_at: `${daysAgo(6)} 12:30:00` },
    { id: 3, created_at: `${today} 18:45:00` },
    { id: 4, created_at: `${daysAgo(1)} 08:00:00` },
  ];

  it('returns everything when bounds are empty', () => {
    expect(filterByBounds(orders, rangeBounds('all'))).toHaveLength(4);
  });

  it('treats both endpoints as inclusive', () => {
    const kept = filterByBounds(orders, lastNDaysBounds(7));
    expect(kept.map((o) => o.id)).toEqual([2, 3, 4]);
  });

  it('excludes orders older than the window', () => {
    const kept = filterByBounds(orders, { start: daysAgo(3), end: today });
    expect(kept.map((o) => o.id)).toEqual([3, 4]);
  });

  it('returns an empty list when nothing falls in the window', () => {
    expect(
      filterByBounds(orders, { start: daysAgo(400), end: daysAgo(390) })
    ).toEqual([]);
  });

  it('drops orders with no usable created_at inside a bounded range', () => {
    const messy = [
      { id: 1, created_at: `${today} 10:00:00` },
      { id: 2, created_at: null },
      { id: 3 },
    ];
    const kept = filterByBounds(messy, rangeBounds('today'));
    expect(kept.map((o) => o.id)).toEqual([1]);
  });

  it('tolerates missing bounds', () => {
    expect(filterByBounds(orders, undefined)).toHaveLength(4);
    expect(filterByBounds(orders, {})).toHaveLength(4);
  });
});
