import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import AdminLayout from './pages/AdminLayout.jsx';
import AdminPage from './pages/AdminPage.jsx';
import PosLayout from './pages/PosLayout.jsx';
import DashboardSection from './pages/DashboardSection.jsx';
import OrdersSection from './pages/OrdersSection.jsx';
import ReportsSection from './pages/ReportsSection.jsx';
import SettingsSection from './pages/SettingsSection.jsx';
import ReceiptPage from './pages/ReceiptPage.jsx';
import ProductDetailModal from './components/ProductDetailModal.jsx';
import Toast from './components/Toast.jsx';
import { useAuthStore } from './stores/authStore.js';

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
  return (
    <>
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

      {/* Global overlays */}
      <ProductDetailModal />
      <Toast />
    </>
  );
}