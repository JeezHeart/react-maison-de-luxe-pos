import { create } from 'zustand';
import { CUSTOMERS, CUSTOMER_TIERS } from '../data/customers.js';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';
import { enqueue } from '../lib/sync.js';

// Editable customer directory, persisted to localStorage and mirrored to the
// shared `customers` table through the sync queue. Mirrors the menu store
// pattern: local-first writes, enqueue -> flush -> pull-merge.

export const STORAGE_KEY = 'luxury_pos_customers';

function cloneSeed() {
  return CUSTOMERS.map((c) => ({ ...c }));
}

function loadCustomers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
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

function persistCustomers(customers) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
  } catch (e) {
    // ignore quota / availability errors
  }
}

export const useCustomerStore = create((set, get) => ({
  customers: loadCustomers(),

  addCustomer: (data) => {
    const customers = [...get().customers];
    const nextId = customers.reduce((max, c) => Math.max(max, c.id), 0) + 1;
    const name = String(data.name || '').trim();
    if (!name) {
      return null;
    }
    // `name` is the upsert key in the shared table — reject duplicates so a
    // new row can never silently overwrite an existing customer's record.
    if (customers.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      return null;
    }
    const customer = {
      id: nextId,
      name,
      phone: String(data.phone || '').trim(),
      email: String(data.email || '').trim(),
      visits: Math.max(0, Number(data.visits) || 0),
      total_spent: Math.max(0, Number(data.total_spent) || 0),
      tier: CUSTOMER_TIERS.includes(data.tier) ? data.tier : 'Bronze',
    };
    const next = [...customers, customer];
    set({ customers: next });
    persistCustomers(next);
    enqueue({ table: 'customers', action: 'upsert', payload: customer });
    return customer;
  },

  updateCustomer: (id, data) => {
    const target = get().customers.find((c) => c.id === id);
    const next = get().customers.map((c) => {
      if (c.id !== id) {
        return c;
      }
      return {
        ...c,
        name: String(data.name ?? c.name).trim(),
        phone: String(data.phone ?? c.phone).trim(),
        email: String(data.email ?? c.email).trim(),
        visits: Math.max(0, Number(data.visits ?? c.visits)),
        total_spent: Math.max(0, Number(data.total_spent ?? c.total_spent)),
        tier: data.tier != null && CUSTOMER_TIERS.includes(data.tier) ? data.tier : c.tier,
      };
    });
    set({ customers: next });
    persistCustomers(next);
    const updated = next.find((c) => c.id === id);
    if (updated) {
      // Renames are inserts under upsert-by-name — drop the old row too,
      // same as the menu store, or the ghost row survives in the cloud.
      if (target && updated.name !== target.name) {
        enqueue({ table: 'customers', action: 'delete', name: target.name });
      }
      enqueue({ table: 'customers', action: 'upsert', payload: updated });
    }
  },

  deleteCustomer: (id) => {
    const target = get().customers.find((c) => c.id === id);
    const next = get().customers.filter((c) => c.id !== id);
    set({ customers: next });
    persistCustomers(next);
    if (target) {
      enqueue({ table: 'customers', action: 'delete', name: target.name });
    }
  },

  reset: () => {
    const seed = cloneSeed();
    set({ customers: seed });
    persistCustomers(seed);
    for (const customer of seed) {
      enqueue({ table: 'customers', action: 'upsert', payload: customer });
    }
  },

  // Pull the shared directory into this device. Remote wins.
  syncFromRemote: async () => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }
    const { data: rows, error } = await supabase
      .from('customers')
      .select('*')
      .order('id');
    if (error) {
      throw error;
    }
    if (!rows || rows.length === 0) {
      return;
    }
    const customers = rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone || '',
      email: r.email || '',
      visits: Number(r.visits) || 0,
      total_spent: Number(r.total_spent) || 0,
      tier: r.tier || 'Bronze',
    }));
    set({ customers });
    persistCustomers(customers);
  },
}));