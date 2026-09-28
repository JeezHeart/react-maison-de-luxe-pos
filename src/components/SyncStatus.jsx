import { useEffect, useState } from 'react';
import { useUIStore } from '../stores/uiStore.js';
import { isSupabaseConfigured } from '../lib/supabase.js';
import { readQueue, onQueueChange } from '../lib/sync.js';

// Cloud-sync pill shown in the admin/POS headers. Hidden entirely when the
// app runs in pure-local (no Supabase) mode.
//
// States:
//   syncing  -> "Syncing…"            (amber pulse)
//   online   -> "Synced"              (+ "· N pending" when the queue has
//                                       items the cloud hasn't accepted yet)
//   offline  -> "Offline"             (+ "· N saved here" when local changes
//                                       are waiting for a connection)
// The queue count updates live: new work lands in the queue (onQueueChange)
// and the flusher nudges syncState after every pass, which re-renders us.
const STATES = {
  syncing: { label: 'Syncing…', className: 'sync-state-syncing' },
  online: { label: 'Synced', className: 'sync-state-online' },
  offline: { label: 'Offline', className: 'sync-state-offline' },
  idle: null,
};

export default function SyncStatus() {
  const syncState = useUIStore((s) => s.syncState);
  const lastSyncAt = useUIStore((s) => s.lastSyncAt);
  const [pending, setPending] = useState(() => readQueue().length);

  useEffect(() => onQueueChange(() => setPending(readQueue().length)), []);
  useEffect(() => {
    // A finished sync pass (or a state flip) means the queue may have drained.
    setPending(readQueue().length);
  }, [syncState]);

  if (!isSupabaseConfigured || !STATES[syncState]) {
    return null;
  }

  let label = STATES[syncState].label;
  if (syncState === 'offline' && pending > 0) {
    label = `${label} · ${pending} saved here`;
  } else if (syncState === 'online' && pending > 0) {
    label = `${label} · ${pending} pending`;
  }

  const title = lastSyncAt
    ? `Data syncs to the cloud when online · Last synced ${new Date(lastSyncAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : 'Data syncs to the cloud when online';

  return (
    <div className={`sync-status ${STATES[syncState].className}`} title={title}>
      <span className="sync-status-dot" aria-hidden="true" />
      {label}
    </div>
  );
}