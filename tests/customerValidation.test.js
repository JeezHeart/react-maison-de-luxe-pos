import { describe, it, expect } from 'vitest';
import { validateCustomer } from '../src/utils/customerValidation.js';

// VALID must not collide with EXISTING, or every "accepts" case would fail on
// the duplicate check instead of exercising what it is meant to.
const VALID = {
  name: 'Dee Slots',
  phone: '+63 912 345 6789',
  email: 'dee@example.com',
  visits: '4',
  total_spent: '1250.50',
  tier: 'Gold',
};

const EXISTING = [
  { id: 1, name: 'Ana Reyes' },
  { id: 2, name: 'Ben Cruz' },
  { id: 3, name: 'Cara Dee' },
];

describe('validateCustomer', () => {
  it('accepts a well-formed customer and returns a payload', () => {
    const { error, payload } = validateCustomer(VALID, { customers: EXISTING });
    expect(error).toBe('');
    expect(payload).toEqual({
      name: 'Dee Slots',
      phone: '+63 912 345 6789',
      email: 'dee@example.com',
      visits: 4,
      total_spent: 1250.5,
      tier: 'Gold',
    });
  });

  it('works with no existing customers supplied', () => {
    const { error, payload } = validateCustomer(VALID);
    expect(error).toBe('');
    expect(payload.name).toBe('Dee Slots');
  });

  it('rejects a missing name', () => {
    expect(validateCustomer({ ...VALID, name: '' }, { customers: EXISTING }).error).toBe(
      'Customer name is required.'
    );
  });

  it('rejects a whitespace-only name', () => {
    expect(validateCustomer({ ...VALID, name: '  ' }, { customers: EXISTING }).error).toBe(
      'Customer name is required.'
    );
  });

  it('trims the name it stores', () => {
    expect(
      validateCustomer({ ...VALID, name: '  Dee Slots  ' }, { customers: EXISTING }).payload.name
    ).toBe('Dee Slots');
  });

  it('rejects a tier outside the allowed list', () => {
    expect(validateCustomer({ ...VALID, tier: 'Diamond' }, { customers: EXISTING }).error).toBe(
      'Pick a valid tier.'
    );
  });

  it('rejects a missing tier', () => {
    expect(validateCustomer({ ...VALID, tier: '' }, { customers: EXISTING }).error).toBe(
      'Pick a valid tier.'
    );
  });

  it('accepts every tier the app offers', () => {
    for (const tier of ['Bronze', 'Silver', 'Gold', 'Platinum']) {
      expect(validateCustomer({ ...VALID, name: 'New Person', tier }, { customers: EXISTING }).error).toBe(
        ''
      );
    }
  });

  it('rejects a duplicate name on create', () => {
    expect(validateCustomer({ ...VALID, name: 'Ana Reyes' }, { customers: EXISTING }).error).toBe(
      'A customer with that name already exists.'
    );
  });

  it('matches duplicates case-insensitively', () => {
    expect(
      validateCustomer({ ...VALID, name: 'ana reyes' }, { customers: EXISTING }).error
    ).toBe('A customer with that name already exists.');
  });

  it('ignores surrounding whitespace when matching duplicates', () => {
    expect(
      validateCustomer({ ...VALID, name: '  ANA REYES  ' }, { customers: EXISTING }).error
    ).toBe('A customer with that name already exists.');
  });

  it('allows saving a customer unchanged, i.e. not a duplicate of itself', () => {
    const { error, payload } = validateCustomer({ ...VALID, name: 'Ana Reyes' }, {
      customers: EXISTING,
      editingId: 1,
    });
    expect(error).toBe('');
    expect(payload.name).toBe('Ana Reyes');
  });

  it('still blocks an edit that collides with a different customer', () => {
    expect(
      validateCustomer({ ...VALID, name: 'Ben Cruz' }, { customers: EXISTING, editingId: 1 }).error
    ).toBe('A customer with that name already exists.');
  });

  it('treats a null editingId as a create', () => {
    expect(
      validateCustomer({ ...VALID, name: 'Ana Reyes' }, { customers: EXISTING, editingId: null })
        .error
    ).toBe('A customer with that name already exists.');
  });

  it('reports the name before the tier', () => {
    expect(
      validateCustomer({ ...VALID, name: '', tier: 'Nope' }, { customers: EXISTING }).error
    ).toBe('Customer name is required.');
  });

  it('reports the tier before the duplicate check', () => {
    expect(
      validateCustomer({ ...VALID, tier: 'Nope' }, { customers: EXISTING }).error
    ).toBe('Pick a valid tier.');
  });

  it('coerces blank numbers to 0 instead of NaN', () => {
    const { payload } = validateCustomer({ ...VALID, visits: '', total_spent: '' });
    expect(payload.visits).toBe(0);
    expect(payload.total_spent).toBe(0);
  });

  it('coerces non-numeric numbers to 0', () => {
    const { payload } = validateCustomer({ ...VALID, visits: 'lots', total_spent: 'free' });
    expect(payload.visits).toBe(0);
    expect(payload.total_spent).toBe(0);
  });

  it('keeps optional fields as typed, including empty strings', () => {
    const { payload } = validateCustomer({ ...VALID, phone: '', email: '' });
    expect(payload.phone).toBe('');
    expect(payload.email).toBe('');
  });

  it('treats a null customer as a missing name rather than throwing', () => {
    expect(validateCustomer(null).error).toBe('Customer name is required.');
    expect(validateCustomer(undefined).error).toBe('Customer name is required.');
  });

  it('survives an existing customer row with no name', () => {
    const { error } = validateCustomer(VALID, { customers: [{ id: 9, name: null }] });
    expect(error).toBe('');
  });

  it('never returns a payload alongside an error', () => {
    const bad = [
      [{ ...VALID, name: '' }, { customers: EXISTING }],
      [{ ...VALID, tier: 'Nope' }, { customers: EXISTING }],
      [{ ...VALID, name: 'Ana Reyes' }, { customers: EXISTING }],
    ];
    for (const [data, ctx] of bad) {
      expect(validateCustomer(data, ctx).payload).toBeNull();
    }
  });
});
