import { create } from 'zustand';

// Restaurant profile — persisted per browser via localStorage.
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
    try {
      localStorage.setItem(NAME_KEY, restaurantName);
      localStorage.setItem(CONTACT_KEY, contact);
      localStorage.setItem(ADDRESS_KEY, address);
    } catch (e) {
      // ignore storage errors
    }
    set({
      restaurantName: sanitizeSavedName(restaurantName || 'Maison de Luxe'),
      contact: contact || '',
      address: address || '',
    });
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
  },
}));