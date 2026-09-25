import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import InvoicePanel from '../components/InvoicePanel.jsx';
import SyncStatus from '../components/SyncStatus.jsx';

// POS shell: sidebar + main content card + (dashboard only) invoice column.
// The invoice column is present on the dashboard and hidden elsewhere.
export default function PosLayout() {
  const location = useLocation();
  const showInvoice = location.pathname === '/pos';

  return (
    <div className="w-full px-3 py-3">
      <div className={`grid grid-cols-12 gap-3 main-layout ${showInvoice ? '' : 'invoice-panel-hidden'}`}>
        <Sidebar />

        <div
          id="mainContentColumn"
          className={`col-span-12 ${showInvoice ? 'lg:col-span-7' : 'lg:col-span-10'}`}
        >
          <div className="content-card p-3 md:p-4">
            <div className="flex items-center justify-between mb-3">
              <SyncStatus />
              <span />
            </div>
            <Outlet />
          </div>
        </div>

        {showInvoice && <InvoicePanel />}
      </div>
    </div>
  );
}