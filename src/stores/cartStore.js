import { create } from 'zustand';
import { useUIStore } from './uiStore.js';
import { useMenuStore } from './menuStore.js';
import { round2 } from '../utils/format.js';

// Invoice cart — in-memory line items for the current order.
// Items are keyed by (id, addons) so two entries with different add-ons
// stay separate on the invoice.
export const useCartStore = create((set, get) => ({
  items: [],

  addToCart: (itemId, itemName, itemPrice, addonText = '') => {
    // Cap the cart at available stock (across add-on variants of the item).
    const menuItems = useMenuStore.getState().items;
    const menuLookup =
      menuItems.find((m) => m.id === itemId) || menuItems.find((m) => m.name === itemName);
    const stock = menuLookup ? Math.max(0, Number(menuLookup.stock) || 0) : Infinity;
    const inCartQty = get().items
      .filter((i) => i.id === itemId)
      .reduce((sum, i) => sum + i.qty, 0);
    if (inCartQty + 1 > stock) {
      useUIStore.getState().showToast(
        stock <= 0
          ? 'Out of stock — cannot add to invoice.'
          : `Only ${stock - inCartQty} left in stock — already on your invoice.`
      );
      return false;
    }
    const keyAddonText = addonText || '';
    const items = [...get().items];
    const foundIndex = items.findIndex(
      (i) => i.id === itemId && i.addons === keyAddonText
    );

    if (foundIndex !== -1) {
      items[foundIndex] = { ...items[foundIndex], qty: items[foundIndex].qty + 1 };
    } else {
      items.push({ id: itemId, name: itemName, price: itemPrice, qty: 1, addons: keyAddonText });
    }

    set({ items });
    useUIStore.getState().showToast('Item added to invoice.');
    return true;
  },

  changeQty: (itemId, changeValue) => {
    let items = [...get().items];
    const index = items.findIndex((i) => i.id === itemId);
    if (index === -1) {
      return;
    }
    const current = items[index];
    const qty = current.qty + changeValue;
    if (qty <= 0) {
      items = items.filter((_, i) => i !== index);
      set({ items });
      return;
    }
    // Increasing beyond available stock is blocked; removing never is.
    if (changeValue > 0) {
      const menuItems = useMenuStore.getState().items;
      const menuLookup = menuItems.find((m) => m.id === itemId);
      if (menuLookup) {
        const stock = Math.max(0, Number(menuLookup.stock) || 0);
        const otherQty = items.reduce(
          (sum, i) => sum + (i.id === itemId ? 0 : i.qty),
          0
        );
        if (otherQty + qty > stock) {
          useUIStore.getState().showToast(
            `Only ${Math.max(0, stock - otherQty)} more in stock — already on your invoice.`
          );
          return;
        }
      }
    }
    items[index] = { ...items[index], qty };
    set({ items });
  },

  clear: () => set({ items: [] }),

  // Derived totals (10% tax) — same math as renderInvoice().
  getTotals() {
    const items = get().items;
    const subTotal = items.reduce((sum, i) => sum + i.qty * i.price, 0);
    const tax = subTotal * 0.1;
    return {
      subTotal: round2(subTotal),
      tax: round2(tax),
      total: round2(subTotal + tax),
    };
  },
}));