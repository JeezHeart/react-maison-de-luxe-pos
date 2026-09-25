import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore } from '../src/stores/cartStore.js';
import { useMenuStore } from '../src/stores/menuStore.js';
import { useUIStore } from '../src/stores/uiStore.js';

const AVOCADO = {
  id: 1,
  name: 'Avocado Toast',
  price: 460,
  category: 'Breakfast',
  description: '',
  stock: 2,
};

beforeEach(() => {
  useMenuStore.setState({ items: [AVOCADO] });
  useUIStore.setState({ toast: null });
  useCartStore.setState({ items: [] });
});

describe('cart oversell guard', () => {
  it('accepts quantity up to remaining stock', () => {
    expect(useCartStore.getState().addToCart(1, 'Avocado Toast', 460)).toBe(true);
    expect(useCartStore.getState().addToCart(1, 'Avocado Toast', 460)).toBe(true);
    expect(useCartStore.getState().items[0].qty).toBe(2);
  });

  it('blocks quantity beyond stock and returns false', () => {
    useCartStore.getState().addToCart(1, 'Avocado Toast', 460);
    useCartStore.getState().addToCart(1, 'Avocado Toast', 460);
    expect(useCartStore.getState().addToCart(1, 'Avocado Toast', 460)).toBe(false);
    expect(useCartStore.getState().items[0].qty).toBe(2);
  });

  it('caps across add-on variants of the same item', () => {
    useCartStore.getState().addToCart(1, 'Avocado Toast', 460, 'Extra Egg');
    useCartStore.getState().addToCart(1, 'Avocado Toast', 460);
    expect(useCartStore.getState().addToCart(1, 'Avocado Toast', 460, 'Extra Egg')).toBe(false);
    const lines = useCartStore.getState().items;
    expect(lines.reduce((sum, i) => sum + i.qty, 0)).toBe(2);
  });

  it('blocks out-of-stock items', () => {
    useMenuStore.setState({ items: [{ ...AVOCADO, stock: 0 }] });
    expect(useCartStore.getState().addToCart(1, 'Avocado Toast', 460)).toBe(false);
    expect(useCartStore.getState().items.length).toBe(0);
  });

  it('changeQty (+) is capped at stock', () => {
    useCartStore.getState().addToCart(1, 'Avocado Toast', 460);
    useCartStore.getState().changeQty(1, 1);
    expect(useCartStore.getState().items[0].qty).toBe(2);
    useCartStore.getState().changeQty(1, 1);
    expect(useCartStore.getState().items[0].qty).toBe(2); // blocked
  });

  it('changeQty (-) reduces freely and removes at zero', () => {
    useCartStore.getState().addToCart(1, 'Avocado Toast', 460);
    useCartStore.getState().addToCart(1, 'Avocado Toast', 460);
    useCartStore.getState().changeQty(1, -1);
    expect(useCartStore.getState().items[0].qty).toBe(1);
    useCartStore.getState().changeQty(1, -1);
    expect(useCartStore.getState().items.length).toBe(0);
  });

  it('a cart line whose menu item was deleted stays editable (no cap lookup)', () => {
    useCartStore.getState().addToCart(1, 'Avocado Toast', 460);
    useMenuStore.setState({ items: [] });
    useCartStore.getState().changeQty(1, 1);
    expect(useCartStore.getState().items[0].qty).toBe(2);
  });
});