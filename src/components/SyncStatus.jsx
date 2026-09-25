import { useUIStore } from '../stores/uiStore.js';
import { isSupabaseConfigured } from '../lib/supabase.js';

// Tiny cloud-sync badge shown in the admin/POS headers. Hidden entirely
// when the app runs in pure-local (no Supabase) mode.
const STATES = {
  syncing: { label: 'Syncing…', className: 'sync-state-syncing' },
  online: { label: 'Synced', className: 'sync-state-online' },
  offline: { label: 'Offline', className: 'sync-state-offline' },
  idle: null,
};

export default function SyncStatus() {
  const syncState = useUIStore((s) => s.syncState);
  if (!isSupabaseConfigured || !STATES[syncState]) {
    return null;
  }
  const state = STATES[syncState];
  return (
    <div className={`sync-status ${state.className}`} title="Data syncs to the cloud when online">
      <span className="sync-status-dot" aria-hidden="true" />
      {state.label}
    </div>
  );
}