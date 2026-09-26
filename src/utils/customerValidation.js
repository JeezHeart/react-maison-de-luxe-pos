// Validation for the customer editor (manager screen).
//
// Extracted from the editor modal so the rules can be unit-tested directly.
// Notably this enforces a unique customer name, case-insensitively, so the
// checkout autocomplete cannot offer the same person twice. The check is
// skipped for the record being edited, otherwise saving an unchanged customer
// would report itself as a duplicate of itself.

import { CUSTOMER_TIERS } from '../data/customers.js';

/**
 * @param {object} data raw form values (numbers may still be strings)
 * @param {{ customers?: Array, editingId?: number|string|null }} context
 * @returns {{ error: string, payload: object|null }} `error` is '' when valid.
 */
export function validateCustomer(data, { customers = [], editingId = null } = {}) {
  const name = String(data?.name || '').trim();

  if (!name) {
    return { error: 'Customer name is required.', payload: null };
  }
  if (!CUSTOMER_TIERS.includes(data?.tier)) {
    return { error: 'Pick a valid tier.', payload: null };
  }

  const duplicate = customers.some(
    (c) => c.id !== editingId && String(c.name || '').trim().toLowerCase() === name.toLowerCase()
  );
  if (duplicate) {
    return { error: 'A customer with that name already exists.', payload: null };
  }

  return {
    error: '',
    payload: {
      name,
      phone: data.phone,
      email: data.email,
      // Blank or non-numeric numbers become 0 rather than NaN.
      visits: Number(data.visits) || 0,
      total_spent: Number(data.total_spent) || 0,
      tier: data.tier,
    },
  };
}
