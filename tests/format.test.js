import { describe, it, expect } from 'vitest';
import {
  parseDate,
  formatDateTime,
  formatDateOnly,
  round2,
  formatPeso,
  formatNumber,
} from '../src/utils/format.js';

describe('parseDate', () => {
  it('parses the stored "YYYY-MM-DD HH:mm:ss" form as local time', () => {
    const d = parseDate('2024-01-15 10:30:00');
    expect(d.getTime()).not.toBeNaN();
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(10);
    expect(d.getMinutes()).toBe(30);
  });

  it('accepts ISO 8601 (timestamptz) returned by the database', () => {
    const d = parseDate('2024-01-15T10:30:00Z');
    expect(d.getTime()).toBe(Date.UTC(2024, 0, 15, 10, 30, 0));
  });

  it('trims Postgres microsecond fractional digits', () => {
    const d = parseDate('2024-01-15T10:30:00.123456+00:00');
    expect(d.getTime()).toBe(Date.UTC(2024, 0, 15, 10, 30, 0, 123));
  });

  it('passes Date instances through unchanged', () => {
    const now = new Date();
    expect(parseDate(now)).toBe(now);
  });

  it('returns an Invalid Date for garbage input', () => {
    expect(parseDate('not a date').getTime()).toBeNaN();
  });
});

describe('format helpers', () => {
  it('formatDateTime round-trips the stored form', () => {
    const str = formatDateTime(new Date(2024, 0, 15, 10, 30, 0));
    expect(str).toBe('2024-01-15 10:30:00');
    expect(formatDateTime(str)).toBe(str);
  });

  it('formatDateOnly returns Y-m-d', () => {
    expect(formatDateOnly(new Date(2024, 0, 15, 10, 30, 0))).toBe('2024-01-15');
  });

  it('round2 / formatPeso / formatNumber basics', () => {
    expect(round2(10.005)).toBe(10.01);
    expect(formatPeso(1234.5)).toBe('₱1,234.50');
    expect(formatNumber(12.345)).toBe('12.35');
  });
});