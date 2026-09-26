import { describe, it, expect } from 'vitest';
import { validateMenuItem } from '../src/utils/menuItemValidation.js';

const VALID = {
  name: 'Truffle Pasta',
  category: 'Dinner',
  description: 'Creamy truffle sauce',
  price: '485',
  stock: '15',
};

describe('validateMenuItem', () => {
  it('accepts a well-formed item and returns a payload', () => {
    const { error, payload } = validateMenuItem(VALID);
    expect(error).toBe('');
    expect(payload).toEqual({
      name: 'Truffle Pasta',
      category: 'Dinner',
      description: 'Creamy truffle sauce',
      price: 485,
      stock: 15,
    });
  });

  it('rejects a missing name', () => {
    expect(validateMenuItem({ ...VALID, name: '' }).error).toBe('Item name is required.');
  });

  it('rejects a whitespace-only name', () => {
    expect(validateMenuItem({ ...VALID, name: '   ' }).error).toBe('Item name is required.');
  });

  it('trims the name it stores', () => {
    expect(validateMenuItem({ ...VALID, name: '  Truffle Pasta  ' }).payload.name).toBe(
      'Truffle Pasta'
    );
  });

  it('rejects a missing category', () => {
    expect(validateMenuItem({ ...VALID, category: '' }).error).toBe('Choose a category.');
  });

  it('rejects a zero price', () => {
    expect(validateMenuItem({ ...VALID, price: '0' }).error).toBe(
      'Price must be greater than zero.'
    );
  });

  it('rejects a negative price', () => {
    expect(validateMenuItem({ ...VALID, price: '-5' }).error).toBe(
      'Price must be greater than zero.'
    );
  });

  it('rejects a non-numeric price', () => {
    expect(validateMenuItem({ ...VALID, price: 'abc' }).error).toBe(
      'Price must be greater than zero.'
    );
  });

  it('rejects an empty price field', () => {
    // Number('') is 0, which is not greater than zero.
    expect(validateMenuItem({ ...VALID, price: '' }).error).toBe(
      'Price must be greater than zero.'
    );
  });

  it('reports the name before the price when both are wrong', () => {
    // Check order is part of the contract: one problem at a time.
    expect(validateMenuItem({ ...VALID, name: '', price: '-1' }).error).toBe(
      'Item name is required.'
    );
  });

  it('reports the category before the price', () => {
    expect(validateMenuItem({ ...VALID, category: '', price: '-1' }).error).toBe(
      'Choose a category.'
    );
  });

  it('coerces a blank stock to 0 instead of NaN', () => {
    const { payload } = validateMenuItem({ ...VALID, stock: '' });
    expect(payload.stock).toBe(0);
  });

  it('coerces a non-numeric stock to 0', () => {
    expect(validateMenuItem({ ...VALID, stock: 'many' }).payload.stock).toBe(0);
  });

  it('accepts a fractional price', () => {
    expect(validateMenuItem({ ...VALID, price: '485.50' }).payload.price).toBe(485.5);
  });

  it('keeps the description exactly as typed, including padding', () => {
    expect(validateMenuItem({ ...VALID, description: '  spaced  ' }).payload.description).toBe(
      '  spaced  '
    );
  });

  it('accepts a missing optional description', () => {
    const { error, payload } = validateMenuItem({ ...VALID, description: undefined });
    expect(error).toBe('');
    expect(payload.description).toBeUndefined();
  });

  it('treats a null item as a missing name rather than throwing', () => {
    expect(validateMenuItem(null).error).toBe('Item name is required.');
    expect(validateMenuItem(undefined).error).toBe('Item name is required.');
  });

  it('never returns a payload alongside an error', () => {
    for (const bad of [{ ...VALID, name: '' }, { ...VALID, category: '' }, { ...VALID, price: '0' }]) {
      expect(validateMenuItem(bad).payload).toBeNull();
    }
  });
});
