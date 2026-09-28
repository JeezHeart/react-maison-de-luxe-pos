import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Sparkles } from 'lucide-react';
import { useAuthStore } from '../stores/authStore.js';
import { useOrderStore } from '../stores/orderStore.js';
import { useMenuStore, LOW_STOCK_THRESHOLD } from '../stores/menuStore.js';
import { useUIStore } from '../stores/uiStore.js';
import { formatPeso, formatDateOnly, round2 } from '../utils/format.js';
import { lastNDaysBounds, filterByBounds } from '../utils/dateRange.js';
import { getMenuImagePath } from '../utils/menu.js';
import { SalesTrendChart, PaymentDonut, TopItemsBar } from '../components/ReportCharts.jsx';
import AnimatedNumber from '../components/AnimatedNumber.jsx';
import {
  loadDemoOrders,
  saveDemoOrders,
  clearDemoOrders,
  generateDemoOrders,
} from '../lib/demoHistory.js';

const SALES_RANGE_OPTIONS = [7, 14, 30];

// Manager overview — sales trend, top sellers and payment mix charts on
// top, then headline KPIs and the low-stock watchlist.
// Managers oversee from here; checkout happens in the cashier register
// under /pos.
export default function AdminPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const orders = useOrderStore((s) => s.orders);
  const menuItems = useMenuStore((s) => s.items);
  const showToast = useUIStore((s) => s.showToast);

  const [salesRange, setSalesRange] = useState(14);

  // View-only demo data (presentation filler). Stored under its own key and
  // merged ONLY into this page's chart inputs — it never enters the sync
  // queue, so the cloud and the Orders ledger keep real data.
  const [demoVersion, setDemoVersion] = useState(0);
  const demoOrders = useMemo(() => loadDemoOrders(), [demoVersion]);
  const viewOrders = useMemo(
    () => (demoOrders.length ? [...demoOrders, ...orders] : orders),
    [demoOrders, orders]
  );

  // Every sales-derived number below is computed from this scoped set, so the
  // range buttons govern the whole page instead of just the trend chart.
  const bounds = useMemo(() => lastNDaysBounds(salesRange), [salesRange]);
  const scoped = useMemo(() => filterByBounds(viewOrders, bounds), [viewOrders, bounds]);

  // The same-sized window immediately before the current one — the baseline
  // for the "▲/▼ % vs previous period" line on the sales card.
  const prevBounds = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - (2 * salesRange - 1));
    const end = new Date();
    end.setDate(end.getDate() - salesRange);
    return { start: formatDateOnly(start), end: formatDateOnly(end) };
  }, [salesRange]);

  const stats = useMemo(() => {
    const today = formatDateOnly(new Date());
    // Deliberately all-time: the "Today" cards are labelled as today, and
    // today always falls inside the range window anyway.
    const todayOrders = viewOrders.filter(
      (o) => String(o.created_at || '').slice(0, 10) === today
    );
    const totalSales = scoped.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const todaySales = todayOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    // Previous window of the same length, immediately before the current one.
    const prevScoped = filterByBounds(viewOrders, prevBounds);
    const prevSalesTotal = prevScoped.reduce(
      (sum, o) => sum + Number(o.total_amount || 0),
      0
    );
    // null = no prior data to compare against (first days of operation).
    const salesDeltaPct =
      prevSalesTotal > 0
        ? ((totalSales - prevSalesTotal) / prevSalesTotal) * 100
        : null;

    // Top 5 selling menu items.
    const itemMap = new Map();
    scoped.forEach((o) => {
      (o.items || []).forEach((it) => {
        const entry = itemMap.get(it.name) || { name: it.name, qty: 0, revenue: 0 };
        entry.qty += it.quantity;
        entry.revenue += it.quantity * it.unit_price;
        itemMap.set(it.name, entry);
      });
    });
    const topItems = [...itemMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

    // Payment method mix.
    const paymentMap = new Map();
    scoped.forEach((o) => {
      const key = o.payment_method || 'Unknown';
      const entry = paymentMap.get(key) || { method: key, count: 0, total: 0 };
      entry.count += 1;
      entry.total += Number(o.total_amount || 0);
      paymentMap.set(key, entry);
    });
    const paymentRows = [...paymentMap.values()]
      .sort((a, b) => b.count - a.count)
      .map((row) => ({
        ...row,
        salesPct: totalSales > 0 ? (row.total / totalSales) * 100 : 0,
      }));

    const lowStockItems = menuItems
      .filter((m) => Number(m.stock) <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => Number(a.stock) - Number(b.stock))
      .slice(0, 8);

    // Cancelled orders = lost revenue.
    const cancelledOrders = scoped.filter(
      (o) => String(o.order_status).toLowerCase() === 'cancelled'
    );
    const lostRevenue = cancelledOrders.reduce(
      (sum, o) => sum + Number(o.total_amount || 0),
      0
    );

    // Total amount given away as discounts.
    const discountTotal = round2(
      scoped.reduce((sum, o) => sum + (Number(o.discount_amount) || 0), 0)
    );

    // Cashier leaderboard (by sales) from the recorded cashier name.
    const cashierMap = new Map();
    scoped.forEach((o) => {
      const name = o.cashier_name || 'N/A';
      const entry = cashierMap.get(name) || { name, count: 0, sales: 0 };
      entry.count += 1;
      entry.sales += Number(o.total_amount || 0);
      cashierMap.set(name, entry);
    });
    const topCashier = [...cashierMap.values()].sort((a, b) => b.sales - a.sales)[0] || null;

    // Daily sales for the last `salesRange` days (zero-filled so the trend
    // chart always has a contiguous axis).
    const dailySales = [];
    for (let i = salesRange - 1; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = formatDateOnly(d);
      dailySales.push({
        date: key,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        total: 0,
      });
    }
    const salesByDate = new Map();
    scoped.forEach((o) => {
      const day = String(o.created_at || '').slice(0, 10);
      salesByDate.set(day, (salesByDate.get(day) || 0) + Number(o.total_amount || 0));
    });
    dailySales.forEach((row) => {
      row.total = round2(salesByDate.get(row.date) || 0);
    });
    const rangeSalesTotal = round2(dailySales.reduce((sum, row) => sum + row.total, 0));

    return {
      totalOrders: scoped.length,
      todayOrders: todayOrders.length,
      totalSales,
      todaySales,
      avgOrderValue: scoped.length > 0 ? totalSales / scoped.length : 0,
      menuItems: menuItems.length,
      lowStockItems,
      topItems,
      paymentRows,
      cancelledCount: cancelledOrders.length,
      lostRevenue,
      discountTotal,
      topCashier,
      dailySales,
      rangeSalesTotal,
      salesDeltaPct,
    };
  }, [viewOrders, scoped, menuItems, salesRange, prevBounds]);

  const handleLoadDemo = () => {
    const generated = generateDemoOrders({ menuItems });
    saveDemoOrders(generated);
    setDemoVersion((v) => v + 1);
    showToast(`Demo ready — ${generated.length} sample orders added to the charts.`, 3200);
  };

  const handleClearDemo = () => {
    clearDemoOrders();
    setDemoVersion((v) => v + 1);
    showToast('Demo data cleared — charts now show real orders only.', 2500);
  };

  return (
    <div id="adminOverview" className="main-section active-section">
      <div className="mb-3">
        <h4 className="section-title m-0 flex items-center gap-1">
          <LayoutDashboard size={26} aria-hidden="true" /> Admin Overview
        </h4>
        <small className="text-muted">
          Business pulse for {currentUser?.name || 'the manager'}. Sales figures
          reflect the last {salesRange} days.
        </small>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {demoOrders.length > 0 ? (
            <>
              <span className="text-muted text-xs">
                Demo: {demoOrders.length} sample orders on charts
              </span>
              <button
                type="button"
                className="btn-outline-secondary-pos btn-sm-pos"
                onClick={handleClearDemo}
              >
                Clear Demo Data
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn-outline-secondary-pos btn-sm-pos flex items-center gap-1"
              onClick={handleLoadDemo}
              title="Fills the charts with ~45 days of realistic sample orders — local-only, never synced to the cloud."
            >
              <Sparkles size={13} aria-hidden="true" /> Load Demo Data
            </button>
          )}
        </div>
        {demoOrders.length > 0 && (
          <div className="alert-pos alert-info-pos text-sm mt-2 mb-0">
            <strong>Demo data active</strong> — sample orders appear in the
            charts on this screen only. The cloud database and the Orders
            ledger keep real data.
          </div>
        )}
      </div>

      {/* Sales trend — headline chart first so it greets the manager */}
      <div className="report-card report-blue">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <h6 className="m-0">Sales Trend</h6>
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-muted text-xs mr-2">
              Last {salesRange} days ·{' '}
              <b style={{ color: 'var(--accent-hover)' }}>{formatPeso(stats.rangeSalesTotal)}</b>
            </span>
            {SALES_RANGE_OPTIONS.map((days) => (
              <button
                key={days}
                type="button"
                className={`sales-range-btn ${salesRange === days ? 'active-range' : ''}`}
                onClick={() => setSalesRange(days)}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>
        <SalesTrendChart data={stats.dailySales} />
      </div>

      {/* Top sellers + payment mix — charts, straight after the trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
        <div>
          <div className="report-card h-full">
            <h6 className="mb-2">Top 5 Selling Items</h6>
            <TopItemsBar items={stats.topItems} />
            <div className="overflow-x-auto">
              <table className="table-pos report-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty Sold</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topItems.length > 0 ? (
                    stats.topItems.map((row) => (
                      <tr key={row.name}>
                        <td>{row.name}</td>
                        <td>{row.qty}</td>
                        <td>{formatPeso(row.revenue)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="text-muted">
                        No item sales data.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <div className="report-card h-full">
            <h6 className="mb-2">Payment Breakdown</h6>
            <PaymentDonut rows={stats.paymentRows} />
            {stats.paymentRows.length === 0 && (
              <p className="text-muted text-sm mb-2">
                Share of total sales ({formatPeso(stats.totalSales)}).
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="table-pos report-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Orders</th>
                    <th>Sales</th>
                    <th>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.paymentRows.length > 0 ? (
                    stats.paymentRows.map((row) => (
                      <tr key={row.method}>
                        <td>{row.method}</td>
                        <td>{row.count}</td>
                        <td>{formatPeso(row.total)}</td>
                        <td>{row.salesPct.toFixed(1)}%</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-muted">
                        No payment data.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
        <div className="stagger-card" style={{ animationDelay: '0ms' }}>
          <div className="report-card report-blue">
            <div className="text-muted text-sm">Today's Sales</div>
            <div className="report-value">
              <AnimatedNumber value={stats.todaySales} format={formatPeso} />
            </div>
          </div>
        </div>
        <div className="stagger-card" style={{ animationDelay: '60ms' }}>
          <div className="report-card report-purple">
            <div className="text-muted text-sm">Today's Orders</div>
            <div className="report-value">
              <AnimatedNumber value={stats.todayOrders} format={(n) => Math.round(n)} />
            </div>
          </div>
        </div>
        <div className="stagger-card" style={{ animationDelay: '120ms' }}>
          <div className="report-card report-green">
            <div className="text-muted text-sm">Sales · Last {salesRange}d</div>
            <div className="report-value">
              <AnimatedNumber value={stats.totalSales} format={formatPeso} />
            </div>
            <div className="text-muted text-xs">{stats.totalOrders} orders</div>
            {stats.salesDeltaPct !== null && (
              <div
                className={`text-xs mt-1 font-semibold ${
                  stats.salesDeltaPct >= 0 ? 'trend-up-text' : 'trend-down-text'
                }`}
              >
                {stats.salesDeltaPct >= 0 ? '▲' : '▼'}{' '}
                {Math.abs(stats.salesDeltaPct).toFixed(1)}% vs previous {salesRange}d
              </div>
            )}
          </div>
        </div>
        <div className="stagger-card" style={{ animationDelay: '180ms' }}>
          <div className="report-card report-orange">
            <div className="text-muted text-sm">Avg Order Value</div>
            <div className="report-value">
              <AnimatedNumber value={stats.avgOrderValue} format={formatPeso} />
            </div>
          </div>
        </div>
        <div className="stagger-card" style={{ animationDelay: '240ms' }}>
          <div className="report-card report-blue">
            <div className="text-muted text-sm">Menu Items</div>
            <div className="report-value">{stats.menuItems}</div>
          </div>
        </div>
        <div className="stagger-card" style={{ animationDelay: '300ms' }}>
          <div className="report-card report-orange">
            <div className="text-muted text-sm">Low Stock Items</div>
            <div className="report-value">{stats.lowStockItems.length}</div>
          </div>
        </div>
        <div className="stagger-card" style={{ animationDelay: '360ms' }}>
          <div className="report-card report-red">
            <div className="text-muted text-sm">Cancelled (Lost Revenue)</div>
            <div className="report-value">
              <AnimatedNumber value={stats.lostRevenue} format={formatPeso} />
            </div>
            <div className="text-muted text-xs">
              {stats.cancelledCount} cancelled order{stats.cancelledCount === 1 ? '' : 's'}
            </div>
          </div>
        </div>
        <div className="stagger-card" style={{ animationDelay: '420ms' }}>
          <div className="report-card report-green">
            <div className="text-muted text-sm">Discounts Given</div>
            <div className="report-value">
              <AnimatedNumber value={stats.discountTotal} format={formatPeso} />
            </div>
          </div>
        </div>
        <div className="stagger-card" style={{ animationDelay: '480ms' }}>
          <div className="report-card report-purple">
            <div className="text-muted text-sm">Top Cashier</div>
            <div className="report-value">{stats.topCashier ? stats.topCashier.name : '—'}</div>
            <div className="text-muted text-xs">
              {stats.topCashier
                ? `${stats.topCashier.count} orders · ${formatPeso(stats.topCashier.sales)}`
                : 'No orders yet'}
            </div>
          </div>
        </div>
      </div>

      {/* Low stock — the manager's at-a-glance reorder view */}
      <div className="mt-3">
        <div className="report-card">
          <div className="flex items-center justify-between mb-2">
            <h6 className="m-0">Low Stock Watchlist</h6>
            <Link className="btn-outline-secondary-pos btn-sm-pos" to="/admin/settings">
              Manage Menu
            </Link>
          </div>
          {stats.lowStockItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3">
              {stats.lowStockItems.map((item) => (
                <div key={item.id} className="order-item-preview flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={getMenuImagePath(item.name)}
                      alt={item.name}
                      className="order-item-thumb"
                    />
                    <div className="text-sm">
                      {item.name}
                      <div className="text-muted text-xs">{item.category}</div>
                    </div>
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      Number(item.stock) === 0 ? 'stock-out-text' : 'stock-low-text'
                    }`}
                  >
                    {Number(item.stock) === 0 ? 'Out of stock' : `${item.stock} left`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted text-sm m-0">All items are well stocked.</p>
          )}
        </div>
      </div>
    </div>
  );
}