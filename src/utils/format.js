// Formatting helpers for currency, numbers and timestamps.

// Parse stored timestamps reliably. The app persists "YYYY-MM-DD HH:mm:ss"
// as local wall time — that string form is NOT standard JS, and Safari would
// return Invalid Date. Normalize the space separator to ISO "T" (still
// local time) before parsing; ISO/timestamptz strings pass straight through.
export function parseDate(value) {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const iso = value.trim().replace(' ', 'T');
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      return d;
    }
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date(NaN) : d;
}

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
  const d = parseDate(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Y-m-d date-only string.
export function formatDateOnly(date) {
  const d = parseDate(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}