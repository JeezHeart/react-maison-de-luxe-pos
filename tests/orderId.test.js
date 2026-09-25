import { describe, it, expect } from 'vitest';
import { nextOrderId } from '../src/stores/orderStore.js';

describe('nextOrderId (collision-safe order ids)', () => {
  it('returns integer ids, unique across rapid calls', () => {
    const seen = new Set();
    for (let i = 0; i < 2000; i += 1) {
      const id = nextOrderId();
      expect(Number.isInteger(id)).toBe(true);
      expect(id).toBeGreaterThan(0);
      seen.add(id);
    }
    expect(seen.size).toBe(2000);
  });

  it('stays inside the bigint column and Number.MAX_SAFE_INTEGER', () => {
    for (let i = 0; i < 500; i += 1) {
      const id = nextOrderId();
      expect(id).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
      expect(id).toBeLessThanOrEqual(9_007_199_254_740_991);
    }
  });

  it('is monotonic — newest orders sort first by id', () => {
    let prev = 0;
    for (let i = 0; i < 100; i += 1) {
      const id = nextOrderId();
      expect(id).toBeGreaterThan(prev);
      prev = id;
    }
  });
});