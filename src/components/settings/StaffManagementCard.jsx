import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, UserCheck, UserX, Eye, EyeOff, Shield, Loader2 } from 'lucide-react';
import { useEmployeeStore } from '../../stores/employeeStore.js';
import { useUIStore } from '../../stores/uiStore.js';
import { useAuthStore } from '../../stores/authStore.js';
import { formatDateOnly } from '../../utils/format.js';

// Staff Management Card — add/edit/deactivate cashiers, set PINs.
export default function StaffManagementCard({ isManager, className = '' }) {
  if (!isManager) return null;

  const employees = useEmployeeStore((s) => s.getAllEmployees());
  const addEmployee = useEmployeeStore((s) => s.addEmployee);
  const updateEmployee = useEmployeeStore((s) => s.updateEmployee);
  const deactivateEmployee = useEmployeeStore((s) => s.deactivateEmployee);
  const activateEmployee = useEmployeeStore((s) => s.activateEmployee);
  const showToast = useUIStore((s) => s.showToast);
  const currentUser = useAuthStore((s) => s.currentUser);

  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState({ name: '', pin: '', role: 'cashier' });
  const [saving, setSaving] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const activeCount = useMemo(() => employees.filter((e) => e.active).length, [employees]);
  const cashierCount = useMemo(() => employees.filter((e) => e.role === 'cashier' && e.active).length, [employees]);
  const managerCount = useMemo(() => employees.filter((e) => e.role === 'manager' && e.active).length, [employees]);

  const openAddModal = () => {
    setEditingEmployee(null);
    setFormData({ name: '', pin: '', role: 'cashier' });
    setShowModal(true);
  };

  const openEditModal = (emp) => {
    setEditingEmployee(emp);
    setFormData({ name: emp.name, pin: '', role: emp.role }); // PIN not prefilled for security
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingEmployee(null);
    setFormData({ name: '', pin: '', role: 'cashier' });
    setShowPin(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingEmployee) {
        const data = { name: formData.name.trim(), role: formData.role };
        if (formData.pin) data.pin = formData.pin;
        const result = updateEmployee(editingEmployee.id, data);
        if (result.success) {
          showToast(`Updated ${formData.name}`, 2000);
          closeModal();
        } else {
          showToast(result.error, 3000);
        }
      } else {
        const result = addEmployee(formData);
        if (result.success) {
          showToast(`Added ${formData.name} as ${formData.role}`, 2000);
          closeModal();
        } else {
          showToast(result.error, 3000);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = (emp) => {
    if (emp.active) {
      // Prevent deactivating the last manager or self
      if (emp.role === 'manager' && managerCount <= 1) {
        showToast('At least one active manager is required', 3000);
        return;
      }
      if (emp.name === currentUser?.name) {
        showToast('You cannot deactivate yourself', 3000);
        return;
      }
      const result = deactivateEmployee(emp.id);
      showToast(result.success ? `Deactivated ${emp.name}` : result.error, result.success ? 2000 : 3000);
    } else {
      const result = activateEmployee(emp.id);
      showToast(result.success ? `Reactivated ${emp.name}` : result.error, result.success ? 2000 : 3000);
    }
  };

  return (
    <div className={`content-card p-3 md:p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h5 className="m-0 flex items-center gap-2">
            <Shield size={20} aria-hidden="true" /> Staff Management
          </h5>
          <p className="text-muted text-sm m-0 mt-1">
            Manage cashiers and their PINs. Managers use Supabase Auth.
          </p>
        </div>
        <button type="button" className="btn-primary-pos" onClick={openAddModal}>
          <Plus size={16} aria-hidden="true" /> Add Staff
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="report-card report-blue p-2">
          <div className="text-muted text-xs">Total Active</div>
          <div className="report-value text-lg">{activeCount}</div>
        </div>
        <div className="report-card report-green p-2">
          <div className="text-muted text-xs">Cashiers</div>
          <div className="report-value text-lg">{cashierCount}</div>
        </div>
        <div className="report-card report-purple p-2">
          <div className="text-muted text-xs">Managers</div>
          <div className="report-value text-lg">{managerCount}</div>
        </div>
      </div>

      {/* Staff table */}
      <div className="overflow-x-auto">
        <table className="table-pos">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>PIN</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.length > 0 ? (
              employees.map((emp) => (
                <tr key={emp.id}>
                  <td className="font-medium">{emp.name}</td>
                  <td>
                    <span className={`status-badge ${emp.role === 'manager' ? 'status-pending' : 'status-completed'}`}>
                      {emp.role}
                    </span>
                  </td>
                  <td>
                    {emp.role === 'cashier' ? (
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono bg-muted/20 px-1.5 py-0.5 rounded">
                          {showPin ? emp.pin : '••••'}
                        </code>
                        <button
                          type="button"
                          className="btn-outline-secondary-pos btn-sm-pos p-1"
                          onClick={() => setShowPin((v) => !v)}
                          title={showPin ? 'Hide PIN' : 'Show PIN'}
                        >
                          {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    ) : (
                      <span className="text-muted text-sm">—</span>
                    )}
                  </td>
                  <td>
                    <span className={`status-badge ${emp.active ? 'status-completed' : 'status-cancelled'}`}>
                      {emp.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="text-sm">
                    {emp.last_login ? formatDateOnly(emp.last_login) : <span className="text-muted">Never</span>}
                  </td>
                  <td className="text-sm text-muted">{formatDateOnly(emp.created_at)}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="btn-outline-secondary-pos btn-sm-pos"
                        onClick={() => openEditModal(emp)}
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      {emp.active ? (
                        <button
                          type="button"
                          className="btn-outline-danger-pos btn-sm-pos"
                          onClick={() => handleToggleActive(emp)}
                          title="Deactivate"
                        >
                          <UserX size={14} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-outline-secondary-pos btn-sm-pos"
                          onClick={() => handleToggleActive(emp)}
                          title="Reactivate"
                        >
                          <UserCheck size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="text-center text-muted py-3">
                  No staff yet. Click "Add Staff" to create the first cashier.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal} role="dialog" aria-modal="true" aria-label={editingEmployee ? 'Edit Staff' : 'Add Staff'}>
          <div className="product-modal-content p-3 md:p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h6 className="m-0">{editingEmployee ? 'Edit Staff' : 'Add New Staff'}</h6>
              <button type="button" className="modal-close-btn" onClick={closeModal} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-2">
                <label className="field-label" htmlFor="staffName">Name</label>
                <input
                  id="staffName"
                  type="text"
                  className="field-control"
                  placeholder="e.g. Jane Smith"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div className="mb-2">
                <label className="field-label" htmlFor="staffRole">Role</label>
                <select
                  id="staffRole"
                  className="field-control"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="cashier">Cashier (uses 4-digit PIN)</option>
                  <option value="manager">Manager (uses Supabase Auth)</option>
                </select>
              </div>

              {formData.role === 'cashier' && (
                <div className="mb-2">
                  <label className="field-label" htmlFor="staffPin">
                    PIN {editingEmployee ? '(leave blank to keep current)' : '(4 digits)'}
                  </label>
                  <input
                    id="staffPin"
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    className="field-control"
                    placeholder={editingEmployee ? '••••' : '1234'}
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                    maxLength={4}
                    required={!editingEmployee}
                  />
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <button type="button" className="btn-outline-secondary-pos flex-1" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-pos flex-1" disabled={saving}>
                  {saving ? <Loader2 size={16} className="animate-spin" /> : (editingEmployee ? 'Save Changes' : 'Add Staff')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}