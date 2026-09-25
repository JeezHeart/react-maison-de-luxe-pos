import { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { useOrderStore } from '../stores/orderStore.js';
import { useMenuStore } from '../stores/menuStore.js';
import { formatPeso, formatDateOnly, round2 } from '../utils/format.js';
import { SalesTrendChart, PaymentDonut, TopItemsBar } from '../components/ReportCharts.jsx';

const RANGES = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

function rangeBounds(range) {
  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');

  if (range === 'today') {
    const s = formatDateOnly(today);
    return { start: s, end: s };
  }
  if (range === 'week') {
    const start = new Date(today.getTime() - 6 * 86400000);
    return { start: formatDateOnly(start), end: formatDateOnly(today) };
  }
  if (range === 'month') {
    return {
      start: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`,
      end: formatDateOnly(today),
    };
  }
  return { start: '', end: '' };
}

// Build a contiguous trend for the selected range: hourly for Today,
// daily for Week/Month, monthly for All Time.
function buildTrend(filtered, reportRange) {
  const add = (map, key, label, amount) => {
    const row = map.get(key) || { key, label, total: 0 };
    row.total += amount;
    map.set(key, row);
  };

  if (reportRange === 'today') {
    const map = new Map();
    filtered.forEach((o) => {
      const t = String(o.created_at || '');
      const h = Number(t.slice(11, 13));
      add(map, h, `${String(h).padStart(2, '0')}:00`, Number(o.total_amount || 0));
    });
    const rows = [];
    for (let h = 0; h < 24; h += 1) {
      rows.push({
        key: h,
        label: `${String(h).padStart(2, '0')}:00`,
        total: round2(map.get(h)?.total || 0),
      });
    }
    return rows;
  }

  if (reportRange === 'week' || reportRange === 'month') {
    const { start, end } = rangeBounds(reportRange);
    const map = new Map();
    filtered.forEach((o) => {
      const day = String(o.created_at || '').slice(0, 10);
      add(map, day, day.slice(5), Number(o.total_amount || 0));
    });
    const rows = [];
    const cursor = new Date(`${start}T00:00:00`);
    const last = new Date(`${end}T00:00:00`);
    while (cursor <= last) {
      const key = formatDateOnly(cursor);
      rows.push({ key, label: key.slice(5), total: round2(map.get(key)?.total || 0) });
      cursor.setDate(cursor.getDate() + 1);
    }
    return rows;
  }

  // All Time — bucket by month so the axis stays readable.
  if (filtered.length === 0) {
    return [];
  }
  const map = new Map();
  filtered.forEach((o) => {
    const t = String(o.created_at || '');
    const key = t.slice(0, 7);
    const d = new Date(`${key}-01T00:00:00`);
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    add(map, key, label, Number(o.total_amount || 0));
  });
  return [...map.values()];
}

// Reports section — sales stats, charts, top selling items and payment
// breakdown with date filters.
export default function ReportsSection() {
  const orders = useOrderStore((s) => s.orders);
  const menuItems = useMenuStore((s) => s.items);

  const [reportRange, setReportRange] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);

  const stats = useMemo(() => {
    const { start, end } = rangeBounds(reportRange);
    const filtered =
      start === ''
        ? orders
        : orders.filter((o) => {
            const day = String(o.created_at || '').slice(0, 10);
            return day >= start && day <= end;
          });

    const totalOrders = filtered.length;
    const totalSales = filtered.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    // Top 5 selling menu items.
    const itemMap = new Map();
    filtered.forEach((o) => {
      (o.items || []).forEach((it) => {
        const entry = itemMap.get(it.name) || { name: it.name, qty: 0, revenue: 0 };
        entry.qty += it.quantity;
        entry.revenue += it.quantity * it.unit_price;
        itemMap.set(it.name, entry);
      });
    });
    const topItems = [...itemMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

    // Payment method breakdown.
    const paymentMap = new Map();
    filtered.forEach((o) => {
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

    // Range deep-dive: cancelled = lost revenue, discounts given, and the
    // leading cashier — all for the selected period.
    const cancelledOrders = filtered.filter(
      (o) => String(o.order_status).toLowerCase() === 'cancelled'
    );
    const lostRevenue = cancelledOrders.reduce(
      (sum, o) => sum + Number(o.total_amount || 0),
      0
    );

    const discountTotal = round2(
      filtered.reduce((sum, o) => sum + (Number(o.discount_amount) || 0), 0)
    );

    const cashierMap = new Map();
    filtered.forEach((o) => {
      const name = o.cashier_name || 'N/A';
      const entry = cashierMap.get(name) || { name, count: 0, sales: 0 };
      entry.count += 1;
      entry.sales += Number(o.total_amount || 0);
      cashierMap.set(name, entry);
    });
    const topCashier = [...cashierMap.values()].sort((a, b) => b.sales - a.sales)[0] || null;

    return {
      totalOrders,
      totalSales,
      avgOrderValue,
      menuItems: menuItems.length,
      topItems,
      paymentRows,
      trendData: buildTrend(filtered, reportRange),
      cancelledCount: cancelledOrders.length,
      lostRevenue,
      discountTotal,
      topCashier,
    };
  }, [orders, reportRange, menuItems, refreshKey]);

  const handleApply = (e) => {
    e.preventDefault();
    // Re-run derived stats (animated card entrance below).
    setRefreshKey((k) => k + 1);
  };

  const rangeLabel = RANGES.find((r) => r.value === reportRange)?.label || 'All Time';

  return (
    <div id="reportsSection" className="main-section active-section">
      <div className="mb-3">
        <h4 className="section-title m-0 flex items-center gap-1">
          <FileText size={26} aria-hidden="true" /> Reports
        </h4>
        <small className="text-muted">Simple sales insights for daily monitoring.</small>
      </div>

      <form className="report-filter-bar mb-3" onSubmit={handleApply}>
        <div className="flex flex-col md:flex-row gap-2 items-center">
          <label htmlFor="report_range" className="text-muted text-sm m-0">
            Date Range
          </label>
          <select
            name="report_range"
            id="report_range"
            className="field-control report-select"
            value={reportRange}
            onChange={(e) => setReportRange(e.target.value)}
          >
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary-pos btn-sm-pos">
            Apply Filter
          </button>
        </div>
      </form>

      {/* Sales trend — right under the filter so the visitor sees it first */}
      <div className="report-card report-blue">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <h6 className="m-0">Sales Trend</h6>
          <span className="text-muted text-xs">
            {RANGES.find((r) => r.value === reportRange)?.label} · Total{' '}
            <b style={{ color: 'var(--accent-hover)' }}>{formatPeso(stats.totalSales)}</b>
          </span>
        </div>
        {stats.trendData.length > 0 ? (
          <SalesTrendChart data={stats.trendData} />
        ) : (
          <p className="text-muted text-sm m-0">No sales in this range yet.</p>
        )}
      </div>

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
            {stats.paymentRows.length === 0 && (
              <p className="text-muted text-sm mb-2">
                Share of total sales ({formatPeso(stats.totalSales)}) for this date range.
              </p>
            )}
            <PaymentDonut rows={stats.paymentRows} />
            <div className="overflow-x-auto">
              <table className="table-pos report-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Orders</th>
                    <th>Total</th>
                    <th>% of sales</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.paymentRows.length > 0 ? (
                    stats.paymentRows.map((row) => (
                      <tr key={row.method}>
                        <td>{row.method}</td>
                        <td>{row.count}</td>
                        <td>{formatPeso(row.total)}</td>
                        <td>
                          <strong>{row.salesPct.toFixed(1)}%</strong>
                          <div
                            className="report-pct-bar"
                            title={`${row.salesPct.toFixed(1)}% of sales`}
                          >
                            <div
                              className="report-pct-fill"
                              style={{ width: `${Math.min(100, Math.max(0, row.salesPct))}%` }}
                            ></div>
                          </div>
                        </td>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3" key={`cards-${reportRange}-${refreshKey}`}>
        <div className="stagger-card" style={{ animationDelay: '0ms' }}>
          <div className="report-card report-blue">
            <div className="text-muted text-sm">Total Orders</div>
            <div className="report-value">{stats.totalOrders}</div>
          </div>
        </div>
        <div className="stagger-card" style={{ animationDelay: '70ms' }}>
          <div className="report-card report-purple">
            <div className="text-muted text-sm">Menu Items</div>
            <div className="report-value">{stats.menuItems}</div>
          </div>
        </div>
        <div className="stagger-card" style={{ animationDelay: '140ms' }}>
          <div className="report-card report-green">
            <div className="text-muted text-sm">Total Sales</div>
            <div className="report-value">{formatPeso(stats.totalSales)}</div>
          </div>
        </div>
        <div className="stagger-card" style={{ animationDelay: '210ms' }}>
          <div className="report-card report-orange">
            <div className="text-muted text-sm">Avg Order Value</div>
            <div className="report-value">{formatPeso(stats.avgOrderValue)}</div>
          </div>
        </div>
      </div>

      {/* Range insights — the deep-dive numbers for the selected period */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3" key={`insights-${reportRange}-${refreshKey}`}>
        <div className="stagger-card" style={{ animationDelay: '0ms' }}>
          <div className="report-card report-red">
            <div className="text-muted text-sm">Cancelled (Lost Revenue)</div>
            <div className="report-value">{formatPeso(stats.lostRevenue)}</div>
            <div className="text-muted text-xs">
              {rangeLabel} · {stats.cancelledCount} cancelled order
              {stats.cancelledCount === 1 ? '' : 's'}
            </div>
          </div>
        </div>
        <div className="stagger-card" style={{ animationDelay: '70ms' }}>
          <div className="report-card report-green">
            <div className="text-muted text-sm">Discounts Given</div>
            <div className="report-value">{formatPeso(stats.discountTotal)}</div>
            <div className="text-muted text-xs">{rangeLabel}</div>
          </div>
        </div>
        <div className="stagger-card" style={{ animationDelay: '140ms' }}>
          <div className="report-card report-purple">
            <div className="text-muted text-sm">Top Cashier</div>
            <div className="report-value">{stats.topCashier ? stats.topCashier.name : '—'}</div>
            <div className="text-muted text-xs">
              {stats.topCashier
                ? `${rangeLabel} · ${stats.topCashier.count} orders · ${formatPeso(stats.topCashier.sales)}`
                : 'No sales in this range'}
            </div>
          </div>
        </div>
      </div>

      <div className="alert-pos alert-info-pos text-sm mt-3 mb-0">
        Reports are filtered by selected date range and based on current database records.
      </div>
    </div>
  );
}