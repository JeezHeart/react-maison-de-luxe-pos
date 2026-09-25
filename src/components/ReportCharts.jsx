import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { formatPeso } from '../utils/format.js';

// Shared dark-theme chart pieces for the reports / admin overview.

export const DONUT_COLORS = ['#e8b86d', '#7b68ee', '#4caf7d', '#e07a5f', '#5b8dd9'];

const darkTooltip = {
  background: '#1a1410',
  border: '1px solid rgba(232, 184, 109, 0.25)',
  borderRadius: 8,
  color: '#f5f0e8',
  fontSize: 12,
};

// Gold area chart of sales over time ({ label, total } rows).
export function SalesTrendChart({ data, height = 240 }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e8b86d" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#e8b86d" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(245,240,232,0.07)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#a89f97', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tick={{ fill: '#a89f97', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `₱${v}`}
          />
          <Tooltip
            contentStyle={darkTooltip}
            cursor={{ stroke: 'rgba(232,184,109,0.35)', strokeWidth: 1 }}
            formatter={(v) => [formatPeso(Number(v)), 'Sales']}
            labelStyle={{ color: '#f5f0e8', fontWeight: 700 }}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#e8b86d"
            strokeWidth={2}
            fill="url(#salesFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Donut of payment-method share ({ method, total, salesPct } rows) with a
// colored legend. Returns null when there is no data.
export function PaymentDonut({ rows }) {
  if (!rows || rows.length === 0) {
    return null;
  }
  return (
    <div>
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="total"
              nameKey="method"
              innerRadius={52}
              outerRadius={74}
              paddingAngle={2}
              stroke="none"
            >
              {rows.map((row, i) => (
                <Cell key={row.method} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={darkTooltip}
              formatter={(v) => formatPeso(Number(v))}
              labelStyle={{ color: '#f5f0e8', fontWeight: 700 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-2 mb-2">
        {rows.map((row, i) => (
          <span key={row.method} className="donut-legend-item">
            <span
              className="donut-legend-dot"
              style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
            ></span>
            {row.method} · {row.salesPct.toFixed(1)}%
          </span>
        ))}
      </div>
    </div>
  );
}

// Horizontal revenue bars for the top-n selling items. Recharts draws the
// vertical layout bottom-up, so the list is reversed to put the top seller
// at the top. Returns null when there is no data.
export function TopItemsBar({ items }) {
  if (!items || items.length === 0) {
    return null;
  }
  const ranked = [...items].reverse();
  return (
    <div style={{ height: 160 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={ranked} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={{ fill: '#a89f97', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={darkTooltip}
            formatter={(v) => [formatPeso(Number(v)), 'Revenue']}
            labelStyle={{ color: '#f5f0e8', fontWeight: 700 }}
            cursor={{ fill: 'rgba(232,184,109,0.06)' }}
          />
          <Bar dataKey="revenue" fill="#e8b86d" radius={[0, 6, 6, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}