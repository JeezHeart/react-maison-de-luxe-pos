import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import PosLayout from './pages/PosLayout.jsx';
import DashboardSection from './pages/DashboardSection.jsx';
import OrdersSection from './pages/OrdersSection.jsx';
import SettingsSection from './pages/SettingsSection.jsx';
import ProductDetailModal from './components/ProductDetailModal.jsx';
import Toast from './components/Toast.jsx';
import { useAuthStore } from './stores/authStore.js';
import { startSyncController } from './lib/syncController.js';

// ---------------------------------------------------------------------------
// Route-level code splitting.
//
// The register (cashier) path is the critical one and stays eager so a
// cashier's first paint never waits on a network round-trip. The manager
// shell and the reports pages are split out because they drag in recharts
// (~280 kB / ~71 kB gzipped) plus the admin-only UI, which a cashier never
// loads at all. The service worker still precaches every emitted chunk, so
// offline startup is unaffected — this only trims the initial parse.
// ---------------------------------------------------------------------------
const AdminLayout = lazy(() => import('./pages/AdminLayout.jsx'));
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));
const ReportsSection = lazy(() => import('./pages/ReportsSection.jsx'));
const ReceiptPage = lazy(() => import('./pages/ReceiptPage.jsx'));

// Matches the app's dark + gold theme while a split chunk is in flight.
function RouteFallback() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="route-loading-spinner" aria-hidden="true" />
      <span className="route-loading-label">Loading…</span>
    </div>
  );
}

// Role gate — logged-out users go to /login; the wrong role gets bounced
// to the correct home (managers -> /admin, cashiers -> /pos).
function RequireRole({ role, children }) {
  const currentUser = useAuthStore((s) => s.currentUser);
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  if (currentUser.role !== role) {
    return <Navigate to={role === 'manager' ? '/pos' : '/admin'} replace />;
  }
  return children;
}

// Routes:
//   /             landing page
//   /login        sign in (redirects by role after login)
//   /admin        manager-only shell: Overview / Orders / Reports / Settings
//   /pos          cashier-only register: Menu / Orders / Reports / Settings
//   /receipt/:id  printable receipt (kept accessible for printing)
export default function App() {
  useEffect(() => {
    // Restore a saved Supabase session (refresh keeps you signed in),
    // then start the background sync controller. Both are no-ops when
    // Supabase isn't configured — pure-local mode.
    useAuthStore.getState().init();
    startSyncController();
  }, []);

  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/admin"
            element={
              <RequireRole role="manager">
                <AdminLayout />
              </RequireRole>
            }
          >
            <Route index element={<AdminPage />} />
            <Route path="orders" element={<OrdersSection />} />
            <Route path="reports" element={<ReportsSection />} />
            <Route path="settings" element={<SettingsSection />} />
          </Route>

          <Route
            path="/pos"
            element={
              <RequireRole role="cashier">
                <PosLayout />
              </RequireRole>
            }
          >
            <Route index element={<DashboardSection />} />
            <Route path="orders" element={<OrdersSection />} />
            <Route path="reports" element={<ReportsSection />} />
            <Route path="settings" element={<SettingsSection />} />
          </Route>

          <Route path="/receipt/:id" element={<ReceiptPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      {/* Global overlays */}
      <ProductDetailModal />
      <Toast />
    </>
  );
}