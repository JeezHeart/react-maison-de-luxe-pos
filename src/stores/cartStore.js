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
    // Block adding items that are currently out of stock.
    const menuLookup = useMenuStore.getState().items.find((m) => m.name === itemName);
    if (menuLookup && Number(menuLookup.stock) <= 0) {
      useUIStore.getState().showToast('Out of stock — cannot add to invoice.');
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
  },

  changeQty: (itemId, changeValue) => {
    let items = [...get().items];
    const index = items.findIndex((i) => i.id === itemId);
    if (index === -1) {
      return;
    }
    const qty = items[index].qty + changeValue;
    if (qty <= 0) {
      items = items.filter((_, i) => i !== index);
    } else {
      items[index] = { ...items[index], qty };
    }
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