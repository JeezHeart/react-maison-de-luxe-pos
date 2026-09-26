// Validation for the menu item editor (manager screen).
//
// Extracted from the editor modal so the rules can be unit-tested directly
// instead of only being reachable by clicking through the form. The order of
// the checks is part of the behaviour: the first failure wins, and each check
// has its own message, so a user is told one thing wrong at a time.

/**
 * @returns {{ error: string, payload: object|null }} `error` is '' when valid.
 */
export function validateMenuItem(data) {
  const name = String(data?.name || '').trim();
  const price = Number(data?.price);

  if (!name) {
    return { error: 'Item name is required.', payload: null };
  }
  if (!data?.category) {
    return { error: 'Choose a category.', payload: null };
  }
  if (!Number.isFinite(price) || price <= 0) {
    return { error: 'Price must be greater than zero.', payload: null };
  }

  return {
    error: '',
    payload: {
      name,
      category: data.category,
      // Deliberately not trimmed: descriptions are free text and are stored
      // as typed.
      description: data.description,
      price,
      // A blank or non-numeric stock field becomes 0 rather than NaN.
      stock: Number(data.stock) || 0,
    },
  };
}
