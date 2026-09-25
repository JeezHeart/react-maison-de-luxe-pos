import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';
import { enqueue } from '../lib/sync.js';

// Restaurant profile — persisted per browser via localStorage (offline
// cache) and mirrored to the shared settings table when online.
const NAME_KEY = 'pos_restaurant_name';
const CONTACT_KEY = 'pos_restaurant_contact';
const ADDRESS_KEY = 'pos_restaurant_address';

function read(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value !== null ? value : fallback;
  } catch (e) {
    return fallback;
  }
}

function sanitizeSavedName(name) {
  // Correct any legacy stored brand value to the current brand.
  if (name === 'Elivé' || name === 'Elive') {
    return 'Maison de Luxe';
  }
  return name;
}

export const useSettingsStore = create((set) => ({
  restaurantName: sanitizeSavedName(read(NAME_KEY, 'Maison de Luxe')),
  contact: read(CONTACT_KEY, ''),
  address: read(ADDRESS_KEY, ''),

  save: ({ restaurantName, contact, address }) => {
    const name = sanitizeSavedName(restaurantName || 'Maison de Luxe');
    const cleanContact = contact || '';
    const cleanAddress = address || '';
    try {
      localStorage.setItem(NAME_KEY, name);
      localStorage.setItem(CONTACT_KEY, cleanContact);
      localStorage.setItem(ADDRESS_KEY, cleanAddress);
    } catch (e) {
      // ignore storage errors
    }
    set({
      restaurantName: name,
      contact: cleanContact,
      address: cleanAddress,
    });
    enqueue({ table: 'settings', action: 'upsert', payload: { key: NAME_KEY, value: name } });
    enqueue({ table: 'settings', action: 'upsert', payload: { key: CONTACT_KEY, value: cleanContact } });
    enqueue({ table: 'settings', action: 'upsert', payload: { key: ADDRESS_KEY, value: cleanAddress } });
  },

  reset: () => {
    try {
      localStorage.removeItem(NAME_KEY);
      localStorage.removeItem(CONTACT_KEY);
      localStorage.removeItem(ADDRESS_KEY);
    } catch (e) {
      // ignore storage errors
    }
    set({ restaurantName: 'Maison de Luxe', contact: '', address: '' });
    enqueue({ table: 'settings', action: 'upsert', payload: { key: NAME_KEY, value: 'Maison de Luxe' } });
    enqueue({ table: 'settings', action: 'upsert', payload: { key: CONTACT_KEY, value: '' } });
    enqueue({ table: 'settings', action: 'upsert', payload: { key: ADDRESS_KEY, value: '' } });
  },

  // Pull the shared restaurant profile into this device. Remote wins;
  // local-only keys are uploaded first by the controller.
  syncFromRemote: async () => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }
    const { data: rows, error } = await supabase.from('settings').select('*');
    if (error) {
      throw error;
    }
    if (!rows || rows.length === 0) {
      return;
    }
    const byKey = {};
    for (const row of rows) {
      byKey[row.key] = row.value ?? '';
    }
    const restaurantName = sanitizeSavedName(byKey[NAME_KEY] ?? 'Maison de Luxe');
    const contact = byKey[CONTACT_KEY] ?? '';
    const address = byKey[ADDRESS_KEY] ?? '';
    try {
      localStorage.setItem(NAME_KEY, restaurantName);
      localStorage.setItem(CONTACT_KEY, contact);
      localStorage.setItem(ADDRESS_KEY, address);
    } catch (e) {
      // ignore storage errors
    }
    set({ restaurantName, contact, address });
  },
}));