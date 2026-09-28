import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';
import { enqueue } from '../lib/sync.js';
import { useAuthStore } from './authStore.js';

export const STORAGE_KEY = 'luxury_pos_employees';

const DEFAULT_CASHIER = {
  id: 1,
  name: 'Main Cashier',
  role: 'cashier',
  pin: '1234', // Default PIN - should be changed on first login
  active: true,
  created_at: new Date().toISOString(),
  last_login: null,
};

function cloneSeed() {
  return { employees: [DEFAULT_CASHIER] };
}

function loadEmployees() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.employees) && parsed.employees.length > 0) {
        return { employees: parsed.employees };
      }
    }
  } catch (e) {
    // ignore corrupt storage and re-seed below
  }
  const seed = cloneSeed();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  } catch (e) {
    // storage unavailable; keep seed in memory only
  }
  return seed;
}

function persistEmployees(employees) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ employees }));
  } catch (e) {
    // ignore quota / availability errors
  }
}

export const useEmployeeStore = create((set, get) => ({
  ...loadEmployees(),

  // Add a new employee (cashier or manager)
  addEmployee: (data) => {
    const employees = [...get().employees];
    const nextId = employees.reduce((max, e) => Math.max(max, e.id), 0) + 1;
    const name = String(data.name || '').trim();
    const pin = String(data.pin || '').trim();
    const role = data.role === 'manager' ? 'manager' : 'cashier';

    if (!name) {
      return { success: false, error: 'Name is required' };
    }
    if (role === 'cashier' && (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin))) {
      return { success: false, error: 'Cashiers require a 4-digit PIN' };
    }
    if (employees.some((e) => e.name.toLowerCase() === name.toLowerCase() && e.active)) {
      return { success: false, error: 'An active employee with this name already exists' };
    }

    const employee = {
      id: nextId,
      name,
      role,
      pin: role === 'cashier' ? pin : null, // Managers use Supabase Auth, not PIN
      active: true,
      created_at: new Date().toISOString(),
      last_login: null,
    };

    const next = [...employees, employee];
    set({ employees: next });
    persistEmployees(next);
    enqueue({ table: 'employees', action: 'upsert', payload: employee });
    return { success: true, employee };
  },

  // Update employee details
  updateEmployee: (id, data) => {
    const employees = get().employees.map((e) => {
      if (e.id !== id) return e;
      const updated = { ...e };
      if (data.name != null) {
        const name = String(data.name).trim();
        if (name) updated.name = name;
      }
      if (data.pin != null) {
        const pin = String(data.pin).trim();
        if (updated.role === 'cashier') {
          if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
            throw new Error('Cashiers require a 4-digit PIN');
          }
          updated.pin = pin;
        }
      }
      if (data.active != null) updated.active = Boolean(data.active);
      if (data.role != null) updated.role = data.role === 'manager' ? 'manager' : 'cashier';
      return updated;
    });
    set({ employees });
    persistEmployees(employees);
    const updated = employees.find((e) => e.id === id);
    if (updated) {
      enqueue({ table: 'employees', action: 'upsert', payload: updated });
    }
    return { success: true };
  },

  // Soft delete (deactivate) - preserves history
  deactivateEmployee: (id) => {
    const target = get().employees.find((e) => e.id === id);
    if (!target) return { success: false, error: 'Employee not found' };
    if (target.role === 'manager' && get().employees.filter((e) => e.role === 'manager' && e.active).length <= 1) {
      return { success: false, error: 'At least one active manager is required' };
    }
    const employees = get().employees.map((e) =>
      e.id === id ? { ...e, active: false } : e
    );
    set({ employees });
    persistEmployees(employees);
    enqueue({ table: 'employees', action: 'upsert', payload: { ...target, active: false } });
    return { success: true };
  },

  // Reactivate a deactivated employee
  activateEmployee: (id) => {
    const target = get().employees.find((e) => e.id === id);
    if (!target) return { success: false, error: 'Employee not found' };
    const employees = get().employees.map((e) =>
      e.id === id ? { ...e, active: true } : e
    );
    set({ employees });
    persistEmployees(employees);
    enqueue({ table: 'employees', action: 'upsert', payload: { ...target, active: true } });
    return { success: true };
  },

  // Verify cashier PIN (used by authStore)
  verifyCashierPin: (name, pin) => {
    const employee = get().employees.find(
      (e) => e.name.toLowerCase() === name.toLowerCase() && e.role === 'cashier' && e.active
    );
    if (!employee) return { valid: false, error: 'Cashier not found or inactive' };
    if (employee.pin !== String(pin)) return { valid: false, error: 'Invalid PIN' };
    // Update last_login
    const employees = get().employees.map((e) =>
      e.id === employee.id ? { ...e, last_login: new Date().toISOString() } : e
    );
    set({ employees });
    persistEmployees(employees);
    enqueue({ table: 'employees', action: 'upsert', payload: employees.find((e) => e.id === employee.id) });
    return { valid: true, employee };
  },

  // Get active cashiers for login dropdown
  getActiveCashiers: () => {
    return get().employees.filter((e) => e.role === 'cashier' && e.active);
  },

  // Get all employees (for admin table)
  getAllEmployees: () => {
    return [...get().employees].sort((a, b) => {
      // Active first, then by role (manager first), then by name
      if (a.active !== b.active) return b.active - a.active;
      if (a.role !== b.role) return a.role === 'manager' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  },

  // Sync from remote (Supabase)
  syncFromRemote: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    const { data: rows, error } = await supabase
      .from('employees')
      .select('*')
      .order('id');
    if (error) throw error;
    if (!rows || rows.length === 0) return;

    const employees = rows.map((r) => ({
      id: r.id,
      name: r.name,
      role: r.role,
      pin: r.pin,
      active: r.active,
      created_at: r.created_at,
      last_login: r.last_login,
    }));
    set({ employees });
    persistEmployees(employees);
  },

  // Reset to seed (dev only)
  reset: () => {
    const seed = cloneSeed();
    set({ employees: seed.employees });
    persistEmployees(seed.employees);
    for (const emp of seed.employees) {
      enqueue({ table: 'employees', action: 'upsert', payload: emp });
    }
  },
}));