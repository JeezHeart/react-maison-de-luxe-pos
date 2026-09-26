import { Settings } from 'lucide-react';
import { useAuthStore } from '../stores/authStore.js';
import RestaurantProfileCard from '../components/settings/RestaurantProfileCard.jsx';
import SystemSnapshotCard from '../components/settings/SystemSnapshotCard.jsx';
import QuickRemindersCard from '../components/settings/QuickRemindersCard.jsx';
import MenuManagementCard from '../components/settings/MenuManagementCard.jsx';
import CustomerDirectoryCard from '../components/settings/CustomerDirectoryCard.jsx';

// Settings screen: restaurant profile, system snapshot, and the two
// manager-only panels (menu management, customer directory).
//
// This file is deliberately just layout and composition. Each card owns its own
// state and store subscriptions, so editing the menu no longer re-renders the
// customer table and vice versa, and each can be read on its own.
export default function SettingsSection() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const isManager = Boolean(currentUser && currentUser.role === 'manager');

  return (
    <div id="settingsSection" className="main-section active-section">
      <div className="mb-3">
        <h4 className="section-title m-0 flex items-center gap-1">
          <Settings size={26} aria-hidden="true" /> Settings
        </h4>
        <small className="text-muted">Project tips and maintenance notes.</small>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 lg:col-span-7">
          <RestaurantProfileCard className="h-full" />
        </div>

        <div className="col-span-12 lg:col-span-5">
          <SystemSnapshotCard className="mb-3" />
          <QuickRemindersCard />
        </div>
      </div>

      <MenuManagementCard isManager={isManager} className="mt-3" />
      <CustomerDirectoryCard isManager={isManager} className="mt-3" />
    </div>
  );
}
