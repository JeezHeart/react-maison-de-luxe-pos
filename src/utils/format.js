// Formatting helpers for currency, numbers and timestamps.

export function formatPeso(value) {
  const n = Number.isFinite(value) ? value : 0;
  return (
    '₱' +
    n.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function formatNumber(value) {
  return (Number.isFinite(value) ? value : 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// "2024-01-15 10:30:00" style timestamp.
export function formatDateTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Y-m-d date-only string.
export function formatDateOnly(date) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}