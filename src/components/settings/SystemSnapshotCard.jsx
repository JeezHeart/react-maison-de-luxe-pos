import { useEffect, useState } from 'react';
import { useOrderStore, USER_COUNT } from '../../stores/orderStore.js';
import { useMenuStore } from '../../stores/menuStore.js';
import { useCustomerStore } from '../../stores/customerStore.js';
import { supabase, isSupabaseConfigured } from '../../lib/supabase.js';

// At-a-glance counts of what is in the system today.
export default function SystemSnapshotCard({ className = '' }) {
  // Narrow selectors: this card only re-renders when a count actually changes,
  // not on every store write.
  const menuCount = useMenuStore((s) => s.items.length);
  const customerCount = useCustomerStore((s) => s.customers.length);
  const orderCount = useOrderStore((s) => s.orders.length);

  // Staff count is not a local store — it is a live count of the auth profiles
  // table when online, falling back to the local estimate while offline or
  // unconfigured (the fallback is a constant, so it is not a subscription).
  const [userCount, setUserCount] = useState(USER_COUNT);
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setUserCount(USER_COUNT);
      return;
    }
    let alive = true;
    (async () => {
      const { count, error } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });
      if (alive && !error && count != null) {
        setUserCount(count);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className={`settings-box ${className}`.trim()}>
      <h6 className="mb-2">System Snapshot</h6>
      <div className="text-sm flex justify-between mb-1">
        <span className="text-muted">Total Users</span>
        <strong>{userCount}</strong>
      </div>
      <div className="text-sm flex justify-between mb-1">
        <span className="text-muted">Menu Items</span>
        <strong>{menuCount}</strong>
      </div>
      <div className="text-sm flex justify-between mb-1">
        <span className="text-muted">Customers</span>
        <strong>{customerCount}</strong>
      </div>
      <div className="text-sm flex justify-between">
        <span className="text-muted">Orders</span>
        <strong>{orderCount}</strong>
      </div>
    </div>
  );
}
