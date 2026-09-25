import { describe, it, expect, beforeEach } from 'vitest';
import { useMenuStore } from '../src/stores/menuStore.js';

const BASE = [
  { id: 1, name: 'Avocado Toast', price: 460, category: 'Breakfast', description: '', stock: 3 },
  { id: 2, name: 'Hot Chocolate', price: 260, category: 'Drinks', description: '', stock: 0 },
];

const stockOf = (name) => useMenuStore.getState().items.find((m) => m.name === name).stock;

beforeEach(() => {
  useMenuStore.setState({ items: BASE });
});

describe('menu stock math', () => {
  it('reduceStock decrements available stock', () => {
    useMenuStore.getState().reduceStock('Avocado Toast', 2);
    expect(stockOf('Avocado Toast')).toBe(1);
  });

  it('reduceStock never goes below zero', () => {
    useMenuStore.getState().reduceStock('Hot Chocolate', 1);
    expect(stockOf('Hot Chocolate')).toBe(0);
    useMenuStore.getState().reduceStock('Hot Chocolate', 5);
    expect(stockOf('Hot Chocolate')).toBe(0);
  });

  it('restoreStock adds stock back', () => {
    useMenuStore.getState().restoreStock('Avocado Toast', 2);
    expect(stockOf('Avocado Toast')).toBe(5);
  });

  it('restoreStock skips missing items silently', () => {
    expect(() => useMenuStore.getState().restoreStock('Nobody', 1)).not.toThrow();
  });
});