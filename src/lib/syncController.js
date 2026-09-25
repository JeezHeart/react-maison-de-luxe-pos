// Sync controller — lives for the whole app session.
//
//   * runs a sync pass right after login and every 30s while signed in
//   * reacts to the browser going online/offline
//   * each pass: push local-only rows up -> flush the queue -> pull
//     everything back down, so the register is always current
//
// It's a no-op when Supabase isn't configured (pure-local mode).

import { supabase, isSupabaseConfigured } from './supabase.js';
import { flushQueue, enqueue, readQueue, onQueueChange } from './sync.js';
import { useUIStore } from '../stores/uiStore.js';
import { useOrderStore } from '../stores/orderStore.js';
import { useMenuStore } from '../stores/menuStore.js';
import { useCustomerStore } from '../stores/customerStore.js';
import { useSettingsStore } from '../stores/settingsStore.js';
import { useAuthStore } from '../stores/authStore.js';

let started = false;
let timer = null;

// Rows that exist locally but not in the shared database get queued for
// upload before we pull. This is the "local fallback -> cloud" migration:
// anything a browser accumulated before Supabase was wired up climbs in.
async function enqueueLocalOnlyDiffs() {
  const localOrders = useOrderStore.getState().orders;
  if (localOrders.length) {
    const { data: remoteOrders } = await supabase.from('orders').select('id');
    const remoteIds = new Set((remoteOrders || []).map((o) => o.id));
    for (const order of localOrders) {
      if (!remoteIds.has(order.id)) {
        enqueue({ table: 'orders', action: 'insert', payload: order });
      }
    }
  }

  const localItems = useMenuStore.getState().items;
  if (localItems.length) {
    const { data: remoteItems } = await supabase.from('menu_items').select('name');
    const remoteNames = new Set((remoteItems || []).map((m) => m.name));
    for (const item of localItems) {
      if (!remoteNames.has(item.name)) {
        enqueue({ table: 'menu', action: 'upsert', payload: item });
      }
    }
  }

  const profile = useSettingsStore.getState();
  const localSettings = [
    { key: 'pos_restaurant_name', value: profile.restaurantName },
    { key: 'pos_restaurant_contact', value: profile.contact },
    { key: 'pos_restaurant_address', value: profile.address },
  ];
  const { data: remoteSettings } = await supabase.from('settings').select('key');
  const remoteKeys = new Set((remoteSettings || []).map((r) => r.key));
  for (const row of localSettings) {
    if (!remoteKeys.has(row.key)) {
      enqueue({ table: 'settings', action: 'upsert', payload: row });
    }
  }

  const localCustomers = useCustomerStore.getState().customers;
  if (localCustomers.length) {
    const { data: remoteCustomers } = await supabase.from('customers').select('name');
    const remoteNames = new Set((remoteCustomers || []).map((c) => c.name));
    for (const customer of localCustomers) {
      if (!remoteNames.has(customer.name)) {
        enqueue({ table: 'customers', action: 'upsert', payload: customer });
      }
    }
  }
}

async function runSync(reason = 'tick') {
  if (!isSupabaseConfigured || !supabase || !useAuthStore.getState().currentUser) {
    return;
  }
  const ui = useUIStore.getState();
  if (ui.syncState === 'syncing') {
    return; // don't stack passes on top of each other
  }
  ui.setSyncState('syncing');

  try {
    await enqueueLocalOnlyDiffs();
    const sent = await flushQueue();

    await Promise.all([
      useOrderStore.getState().syncFromRemote(),
      useMenuStore.getState().syncFromRemote(),
      useCustomerStore.getState().syncFromRemote(),
      useSettingsStore.getState().syncFromRemote(),
    ]);

    ui.setSyncState('online', Date.now());

    const pending = readQueue().length;
    if (pending > 0) {
      ui.showToast("Some changes couldn't reach the cloud yet — will retry.", 3000);
    } else if (sent > 0) {
      ui.showToast(sent === 1 ? 'Synced 1 change' : `Synced ${sent} changes`, 2500);
    } else if (reason === 'online') {
      ui.showToast('Back online — everything is synced', 1800);
    }
  } catch (e) {
    ui.setSyncState('offline');
  }
}

export function startSyncController() {
  if (started || !isSupabaseConfigured || typeof window === 'undefined') {
    return;
  }
  started = true;

  // New queued work (order placed, edit, delete, undo, restock…) triggers a
  // sync within ~1.2s instead of waiting for the 30s tick — two registers
  // see each other's changes in near-real-time.
  let queueSyncTimer = null;
  onQueueChange(() => {
    if (!useAuthStore.getState().currentUser) {
      return;
    }
    if (queueSyncTimer) {
      clearTimeout(queueSyncTimer);
    }
    queueSyncTimer = setTimeout(() => {
      queueSyncTimer = null;
      runSync('change');
    }, 1200);
  });

  window.addEventListener('online', () => runSync('online'));
  window.addEventListener('offline', () => useUIStore.getState().setSyncState('offline'));

  // Login session changes kick off a sync pass immediately.
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
      runSync('login');
    }
  });

  // Light periodic pass keeps the register in sync across devices.
  timer = window.setInterval(() => runSync('tick'), 30_000);
}