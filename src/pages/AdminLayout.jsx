import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';

// Admin shell — sidebar (Overview/Orders/Reports/Settings) + content card.
// Managers oversee the business from here; the cashier register lives
// under /pos and is off-limits to managers.
export default function AdminLayout() {
  return (
    <div className="w-full px-3 py-3">
      <div className="grid grid-cols-12 gap-3">
        <Sidebar mode="admin" />

        <div id="mainContentColumn" className="col-span-12 lg:col-span-10">
          <div className="content-card p-3 md:p-4">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}