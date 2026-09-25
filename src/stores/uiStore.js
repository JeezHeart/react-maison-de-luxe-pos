import { create } from 'zustand';

// Global UI state: toast notifications, product modal and mobile invoice toggle.
let toastTimer = null;

export const useUIStore = create((set, get) => ({
  toast: null, // { message, key, action }
  showToast: (message, durationMs = 1100, action = null) => {
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    toastTimer = setTimeout(() => {
      get().hideToast();
    }, durationMs || 1100);
    set({ toast: { message, key: Date.now(), action } });
  },
  hideToast: () => set({ toast: null }),

  // Product detail modal state.
  selectedProduct: null, // menu item object
  selectedAddOns: [],
  setSelectedProduct: (item) => set({ selectedProduct: item, selectedAddOns: [] }),
  toggleAddOn: (addon) =>
    set((state) => {
      const exists = state.selectedAddOns.some((a) => a.id === addon.id);
      return {
        selectedAddOns: exists
          ? state.selectedAddOns.filter((a) => a.id !== addon.id)
          : [...state.selectedAddOns, addon],
      };
    }),
  clearSelectedProduct: () => set({ selectedProduct: null, selectedAddOns: [] }),

  // Mobile show/hide invoice.
  mobileInvoiceVisible: false,
  toggleMobileInvoice: () =>
    set((state) => ({ mobileInvoiceVisible: !state.mobileInvoiceVisible })),
}));