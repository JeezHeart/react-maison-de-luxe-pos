import { describe, it, expect, vi, beforeEach } from 'vitest';

// A fake Supabase client that records what the sync layer asked the database
// to do, so the atomicity fix can be tested without a live database.
const rpcCalls = [];
const upsertedRows = [];
const updatedRows = [];
let rpcResult = [{ item_name: 'Avocado Toast', stock: 2, shortfall: 0 }];
let rpcError = null;

// Supabase query builders are chainable and awaitable, so the fake has to be
// too — a flat object would make every .eq() a TypeError and quietly turn a
// passing assertion into a false one.
function fakeQuery() {
  const result = { data: [{ stock: 4 }], error: null };
  const q = {
    select: () => q,
    update: (patch) => {
      updatedRows.push(patch);
      return q;
    },
    upsert: (row) => {
      upsertedRows.push(row);
      return q;
    },
    delete: () => q,
    eq: () => q,
    // maybeSingle resolves to one row, not an array of them.
    maybeSingle: () => Promise.resolve({ data: { stock: 4 }, error: null }),
    single: () => Promise.resolve({ data: { stock: 4 }, error: null }),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return q;
}

vi.mock('../src/lib/supabase.js', () => ({
  supabase: {
    rpc: async (fn, args) => {
      rpcCalls.push({ fn, args });
      return rpcError ? { data: null, error: rpcError } : { data: rpcResult, error: null };
    },
    from: () => fakeQuery(),
  },
  isSupabaseConfigured: true,
  verifyPassword: async () => null,
}));

const { useMenuStore } = await import('../src/stores/menuStore.js');
const { readQueue, flushQueue, onStockShortfall, enqueue } = await import('../src/lib/sync.js');

const BASE = [
  { id: 1, name: 'Avocado Toast', price: 460, category: 'Breakfast', description: '', stock: 3 },
  { id: 2, name: 'Hot Chocolate', price: 260, category: 'Drinks', description: '', stock: 0 },
];

const queued = () => readQueue();
const opsFor = (table) => queued().filter((op) => op.table === table);

beforeEach(() => {
  localStorage.clear();
  rpcCalls.length = 0;
  upsertedRows.length = 0;
  updatedRows.length = 0;
  rpcError = null;
  rpcResult = [{ item_name: 'Avocado Toast', stock: 2, shortfall: 0 }];
  useMenuStore.setState({ items: BASE.map((m) => ({ ...m })) });
});

describe('stock movements are queued as movements, not absolute upserts', () => {
  it('reduceStock queues a decrement carrying the name and quantity', () => {
    useMenuStore.getState().reduceStock('Avocado Toast', 2);
    const ops = opsFor('stock');
    expect(ops).toHaveLength(1);
    expect(ops[0].action).toBe('decrement');
    expect(ops[0].payload).toEqual({ name: 'Avocado Toast', qty: 2 });
  });

  // The original defect: a menu upsert carrying an absolute stock number, so
  // two registers each wrote their own value and the last write won.
  it('reduceStock no longer queues a menu upsert at all', () => {
    useMenuStore.getState().reduceStock('Avocado Toast', 1);
    expect(opsFor('menu')).toHaveLength(0);
  });

  it('restoreStock queues an increment', () => {
    useMenuStore.getState().restoreStock('Avocado Toast', 3);
    const ops = opsFor('stock');
    expect(ops).toHaveLength(1);
    expect(ops[0].action).toBe('increment');
    expect(ops[0].payload.qty).toBe(3);
  });

  it('a zero or missing quantity still moves at least one unit', () => {
    useMenuStore.getState().reduceStock('Avocado Toast', 0);
    expect(opsFor('stock')[0].payload.qty).toBe(1);
  });

  it('local stock still updates immediately so the UI is instant', () => {
    useMenuStore.getState().reduceStock('Avocado Toast', 2);
    expect(useMenuStore.getState().items[0].stock).toBe(1);
  });
});

describe('stock seeding vs stock editing', () => {
  it('a new item seeds its own stock', () => {
    useMenuStore.getState().addItem({
      name: 'New Item',
      price: 100,
      category: 'Drinks',
      description: '',
      stock: 12,
    });
    const op = opsFor('menu')[0];
    expect(op.setStock).toBe(true);
  });

  it('a price-only edit does not write stock back', () => {
    useMenuStore.getState().updateItem(1, { name: 'Avocado Toast', price: 500 });
    const menuOps = opsFor('menu');
    expect(menuOps).toHaveLength(1);
    expect(menuOps[0].setStock).toBeUndefined();
    expect(opsFor('stockSet')).toHaveLength(0);
  });

  it('an explicit recount is queued as an authoritative set', () => {
    useMenuStore.getState().updateItem(1, { name: 'Avocado Toast', stock: 25 });
    const sets = opsFor('stockSet');
    expect(sets).toHaveLength(1);
    expect(sets[0].payload).toEqual({ name: 'Avocado Toast', stock: 25 });
  });

  it('renaming seeds the new row rather than moving stock', () => {
    useMenuStore.getState().updateItem(1, { name: 'Avocado Toast Deluxe' });
    const menuOps = opsFor('menu');
    const upsert = menuOps.find((op) => op.action === 'upsert');
    expect(upsert.setStock).toBe(true);
    expect(menuOps.some((op) => op.action === 'delete')).toBe(true);
    expect(opsFor('stockSet')).toHaveLength(0);
  });

  it('a negative recount is floored at zero, not sent as a negative', () => {
    useMenuStore.getState().updateItem(1, { name: 'Avocado Toast', stock: -5 });
    expect(opsFor('stockSet')[0].payload.stock).toBe(0);
  });
});

describe('dispatching stock to the database', () => {
  it('a sale becomes a negative delta through the database function', async () => {
    useMenuStore.getState().reduceStock('Avocado Toast', 2);
    await flushQueue();
    expect(rpcCalls).toEqual([
      { fn: 'apply_stock_movement', args: { p_name: 'Avocado Toast', p_delta: -2 } },
    ]);
  });

  it('a restock becomes a positive delta', async () => {
    useMenuStore.getState().restoreStock('Avocado Toast', 1);
    await flushQueue();
    expect(rpcCalls[0].args).toEqual({ p_name: 'Avocado Toast', p_delta: 1 });
  });

  it('an explicit recount goes through the setter, not the movement', async () => {
    useMenuStore.getState().updateItem(1, { name: 'Avocado Toast', stock: 40 });
    await flushQueue();
    expect(rpcCalls).toEqual([
      { fn: 'set_menu_item_stock', args: { p_name: 'Avocado Toast', p_value: 40 } },
    ]);
  });

  it('a satisfied movement reports no shortfall', async () => {
    const seen = [];
    const off = onStockShortfall((d) => seen.push(d));
    useMenuStore.getState().reduceStock('Avocado Toast', 1);
    await flushQueue();
    off();
    expect(seen).toHaveLength(0);
  });

  // The whole point: the second register is told, rather than the oversell
  // disappearing into whichever number synced last.
  it('a refused movement raises a shortfall so a human is told', async () => {
    rpcResult = [{ item_name: 'Avocado Toast', stock: 0, shortfall: 2 }];
    const seen = [];
    const off = onStockShortfall((d) => seen.push(d));
    useMenuStore.getState().reduceStock('Avocado Toast', 2);
    await flushQueue();
    off();
    expect(seen).toEqual([{ name: 'Avocado Toast', shortfall: 2, stock: 0 }]);
  });

  it('a failing function keeps the op queued for the next pass', async () => {
    const { supabase } = await import('../src/lib/supabase.js');
    const original = supabase.rpc;
    supabase.rpc = async () => ({ data: null, error: { message: 'offline' } });
    useMenuStore.getState().reduceStock('Avocado Toast', 1);
    const sent = await flushQueue();
    supabase.rpc = original;
    expect(sent).toBe(0);
    expect(opsFor('stock')).toHaveLength(1);
  });

  it('a menu edit reaches the database without a stock column', async () => {
    useMenuStore.getState().updateItem(1, { name: 'Avocado Toast', price: 777 });
    await flushQueue();
    expect(upsertedRows).toHaveLength(1);
    expect(upsertedRows[0].price).toBe(777);
    expect('stock' in upsertedRows[0]).toBe(false);
  });
});

describe('queue hygiene', () => {
  it('an op for an unnamed item is dropped rather than sent', async () => {
    enqueue({ table: 'stock', action: 'decrement', payload: { name: '', qty: 1 } });
    await flushQueue();
    expect(rpcCalls).toHaveLength(0);
  });
});

// If the app reaches production before migration 0003 does, stock must still
// sync rather than piling up in the queue forever.
describe('deploying ahead of migration 0003', () => {
  it('falls back to a plain write when the function does not exist', async () => {
    rpcError = { code: 'PGRST202', message: 'Could not find the function' };
    useMenuStore.getState().reduceStock('Avocado Toast', 2);
    const sent = await flushQueue();
    expect(sent).toBe(1);
    expect(updatedRows).toEqual([{ stock: 2 }]); // read 4, minus 2, floored
    expect(opsFor('stock')).toHaveLength(0); // drained, not stranded
  });

  it('a recount falls back too, so the menu editor still works', async () => {
    rpcError = { code: 'PGRST202', message: 'Could not find the function' };
    useMenuStore.getState().updateItem(1, { name: 'Avocado Toast', stock: 30 });
    await flushQueue();
    expect(updatedRows).toEqual([{ stock: 30 }]);
    expect(opsFor('stockSet')).toHaveLength(0); // drained, not stranded
  });

  it('a genuine database error is not swallowed', async () => {
    rpcError = { code: '42501', message: 'permission denied' };
    useMenuStore.getState().reduceStock('Avocado Toast', 1);
    const sent = await flushQueue();
    expect(sent).toBe(0);
    expect(opsFor('stock')).toHaveLength(1); // kept for retry
  });
});
