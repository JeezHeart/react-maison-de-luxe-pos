import { create } from 'zustand';
import { MENU_CATEGORIES, MENU_ITEMS } from '../data/menu.js';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';
import { enqueue } from '../lib/sync.js';

// Editable menu catalog, persisted to localStorage. Seeded from the
// bundled catalog on first run; every add/edit/delete is saved back so
// the POS dashboard, product modal and seed-order pricing all read the
// same live menu.

export const STORAGE_KEY = 'luxury_pos_menu';

// Stock levels at or below this count get the "Low Stock" badge.
export const LOW_STOCK_THRESHOLD = 5;

function cloneSeed() {
  return {
    categories: [...MENU_CATEGORIES],
    items: MENU_ITEMS.map((m) => ({ ...m })),
  };
}

function loadMenu() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items) && Array.isArray(parsed.categories)) {
        return {
          categories: parsed.categories.map(String),
          items: parsed.items,
        };
      }
    }
  } catch (e) {
    // ignore corrupt storage and re-seed below
  }
  const seed = cloneSeed();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  } catch (e) {
    // storage unavailable; keep seed in memory only
  }
  return seed;
}

function persistMenu(menu) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ categories: menu.categories, items: menu.items })
    );
  } catch (e) {
    // ignore quota / availability errors
  }
}

export const useMenuStore = create((set, get) => ({
  ...loadMenu(),

  addItem: (data) => {
    const items = [...get().items];
    const nextId = items.reduce((max, m) => Math.max(max, m.id), 0) + 1;
    const name = String(data.name || '').trim();
    if (!name) {
      return null;
    }
    const category = get().categories.includes(data.category)
      ? data.category
      : get().categories[0] || '';
    const item = {
      id: nextId,
      name,
      category,
      description: String(data.description || '').trim(),
      price: Number(data.price) || 0,
      stock: Number(data.stock) || 0,
    };
    const next = [...items, item];
    set({ items: next });
    persistMenu(get());
    enqueue({ table: 'menu', action: 'upsert', payload: item });
    return item;
  },

  updateItem: (id, data) => {
    const target = get().items.find((m) => m.id === id);
    const items = get().items.map((m) => {
      if (m.id !== id) {
        return m;
      }
      return {
        ...m,
        name: String(data.name ?? m.name).trim(),
        category: data.category ?? m.category,
        description: String(data.description ?? m.description).trim(),
        price: Number(data.price ?? m.price),
        stock: Number(data.stock ?? m.stock),
      };
    });
    set({ items });
    persistMenu(get());
    const updated = items.find((m) => m.id === id);
    if (updated) {
      // Renames are inserts of a new name under upsert-by-name — drop the
      // old row too or it would linger in the cloud forever (and come back
      // on the next pull as a duplicate). Delete first, then upsert.
      if (target && updated.name !== target.name) {
        enqueue({ table: 'menu', action: 'delete', name: target.name });
      }
      enqueue({ table: 'menu', action: 'upsert', payload: updated });
    }
  },

  deleteItem: (id) => {
    const target = get().items.find((m) => m.id === id);
    const next = get().items.filter((m) => m.id !== id);
    set({ items: next });
    persistMenu(get());
    if (target) {
      enqueue({ table: 'menu', action: 'delete', name: target.name });
    }
  },

  addCategory: (name) => {
    const cat = String(name || '').trim();
    if (!cat) {
      return false;
    }
    if (get().categories.some((c) => c.toLowerCase() === cat.toLowerCase())) {
      return false;
    }
    const next = [...get().categories, cat];
    set({ categories: next });
    persistMenu(get());
    return true;
  },

  renameCategory: (oldName, newName) => {
    const next = String(newName || '').trim();
    if (!next) {
      return false;
    }
    if (get().categories.some((c) => c !== oldName && c.toLowerCase() === next.toLowerCase())) {
      return false;
    }
    set({
      categories: get().categories.map((c) => (c === oldName ? next : c)),
      items: get().items.map((m) => (m.category === oldName ? { ...m, category: next } : m)),
    });
    persistMenu(get());
    // Categories are derived from the items' category column, so a rename
    // syncs naturally as every moved item is re-uploaded by name.
    for (const item of get().items) {
      if (item.category === next) {
        enqueue({ table: 'menu', action: 'upsert', payload: item });
      }
    }
    return true;
  },

  deleteCategory: (name) => {
    if (get().items.some((m) => m.category === name)) {
      return false;
    }
    const next = get().categories.filter((c) => c !== name);
    set({ categories: next });
    persistMenu(get());
    return true;
  },

  reset: () => {
    const seed = cloneSeed();
    set({ categories: seed.categories, items: seed.items });
    persistMenu(get());
    for (const item of seed.items) {
      enqueue({ table: 'menu', action: 'upsert', payload: item });
    }
  },

  // Decrement stock for the named item (used when an order is placed).
  // Never goes below zero; missing items are skipped silently.
  reduceStock: (name, qty = 1) => {
    const amount = Math.max(1, Number(qty) || 1);
    set({
      items: get().items.map((m) =>
        m.name === String(name)
          ? { ...m, stock: Math.max(0, Number(m.stock) - amount) }
          : m
      ),
    });
    persistMenu(get());
    const reduced = get().items.find((m) => m.name === String(name));
    if (reduced) {
      enqueue({ table: 'menu', action: 'upsert', payload: reduced });
    }
  },

  // Pull the shared catalog into this device. Remote wins; local-only
  // items are uploaded first by the controller.
  syncFromRemote: async () => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }
    const { data: rows, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('id');
    if (error) {
      throw error;
    }
    if (!rows || rows.length === 0) {
      return;
    }
    const categories = [...new Set(rows.map((r) => r.category))];
    const items = rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      description: r.description || '',
      price: Number(r.price) || 0,
      stock: Number(r.stock) || 0,
    }));
    set({ categories, items });
    persistMenu(get());
  },
}));