import { NavLink, Link } from 'react-router-dom';
import {
  ArrowLeft,
  LayoutGrid,
  LayoutDashboard,
  ShoppingBag,
  BarChart3,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore.js';

const POS_NAV = [
  { to: '/pos', label: 'Menu', icon: LayoutGrid, end: true },
  { to: '/pos/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/pos/reports', label: 'Reports', icon: BarChart3 },
  { to: '/pos/settings', label: 'Settings', icon: Settings },
];

const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

// Sidebar for both shells:
//   mode="pos"   — cashier register (Menu/Orders/Reports/Settings)
//   mode="admin" — manager oversight (Overview/Orders/Reports/Settings only —
//                  no checkout, that is the cashier's job)
export default function Sidebar({ mode = 'pos' }) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);

  const isAdminMode = mode === 'admin';

  const navItems = isAdminMode ? ADMIN_NAV : POS_NAV;

  const homeTo = isAdminMode ? '/admin' : '/pos';
  const brandSub = isAdminMode ? 'Admin Panel' : 'Point of Sale';

  return (
    <div className="col-span-12 lg:col-span-2 pos-sidebar-col">
      <aside className="sidebar-card pos-sidebar">
        <Link to="/" className="sidebar-back-btn" title="Return to landing page">
          <ArrowLeft size={15} aria-hidden="true" />
          <span>Back to home</span>
        </Link>

        <Link to={homeTo} className="sidebar-brand" title={isAdminMode ? 'Admin overview' : 'Menu & checkout'}>
          <img
            src="/assets/images/maison-logo-mark.png"
            alt="Maison de Luxe"
            className="sidebar-brand-mark brand-logo-img"
          />
          <span className="sidebar-brand-text">
            <span className="sidebar-brand-name">Maison de Luxe</span>
            <span className="sidebar-brand-sub">{brandSub}</span>
          </span>
        </Link>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `sidebar-nav-btn ${isActive ? 'active-icon' : ''}`
              }
            >
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <span className="sidebar-foot-dot"></span>
          <span className="sidebar-user-name">{currentUser?.name || 'User'}</span>
          <span className="sidebar-user-role">
            {currentUser?.role === 'manager' ? 'Manager' : 'Cashier'}
          </span>
          <button
            type="button"
            className="sidebar-logout-btn"
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={14} aria-hidden="true" />
          </button>
        </div>
      </aside>
    </div>
  );
}