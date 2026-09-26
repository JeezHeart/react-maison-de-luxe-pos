import { useState } from 'react';
import { Plus, Search, Trash2, Users } from 'lucide-react';
import { useCustomerStore } from '../../stores/customerStore.js';
import { useUIStore } from '../../stores/uiStore.js';
import { formatPeso } from '../../utils/format.js';
import { validateCustomer } from '../../utils/customerValidation.js';
import ManagerGate from './ManagerGate.jsx';
import CustomerEditorModal from './CustomerEditorModal.jsx';

const EMPTY_CUSTOMER = { name: '', phone: '', email: '', visits: '0', total_spent: '0', tier: 'Bronze' };

// Manager-only customer directory. The names here autocomplete on the checkout
// screen, which is why uniqueness is enforced in validateCustomer.
export default function CustomerDirectoryCard({ isManager, className = '' }) {
  const customers = useCustomerStore((s) => s.customers);
  const addCustomer = useCustomerStore((s) => s.addCustomer);
  const updateCustomer = useCustomerStore((s) => s.updateCustomer);
  const deleteCustomer = useCustomerStore((s) => s.deleteCustomer);
  const restoreCustomer = useCustomerStore((s) => s.restoreCustomer);
  const showToast = useUIStore((s) => s.showToast);

  const [customerSearch, setCustomerSearch] = useState('');
  const [customerEditor, setCustomerEditor] = useState(null); // { mode, customer }
  const [customerEditorError, setCustomerEditorError] = useState('');

  const openCustomerCreate = () => {
    setCustomerEditor({ mode: 'create', customer: { ...EMPTY_CUSTOMER } });
    setCustomerEditorError('');
  };

  const openCustomerEdit = (customer) => {
    setCustomerEditor({
      mode: 'edit',
      customer: {
        ...customer,
        visits: String(customer.visits),
        total_spent: String(customer.total_spent),
      },
    });
    setCustomerEditorError('');
  };

  // Functional update so typing cannot race a stale `customerEditor` closure.
  const onFieldChange = (field, value) => {
    setCustomerEditor((prev) => ({ ...prev, customer: { ...prev.customer, [field]: value } }));
  };

  const handleSaveCustomer = (e) => {
    e.preventDefault();
    const editingId =
      customerEditor.mode === 'edit' ? customerEditor.customer.id : null;
    const { error, payload } = validateCustomer(customerEditor.customer, {
      customers,
      editingId,
    });
    if (error) {
      setCustomerEditorError(error);
      return;
    }
    if (customerEditor.mode === 'create') {
      const created = addCustomer(payload);
      if (created) {
        showToast(`"${created.name}" added to the customer directory.`);
        setCustomerEditor(null);
      } else {
        // validateCustomer already rejected duplicates, so this is a backstop
        // for a race with another register.
        setCustomerEditorError('A customer with that name already exists.');
      }
    } else {
      updateCustomer(editingId, payload);
      showToast('Customer updated.');
      setCustomerEditor(null);
    }
  };

  const handleDeleteCustomer = (customer) => {
    if (
      window.confirm(
        `Delete "${customer.name}" from the customer directory? You can undo this right away.`
      )
    ) {
      deleteCustomer(customer.id);
      // Short window to undo before the cloud delete sticks.
      showToast(`"${customer.name}" removed from the directory.`, 4000, {
        label: 'Undo',
        onClick: () => restoreCustomer(customer),
      });
    }
  };

  const keyword = customerSearch.trim().toLowerCase();
  const filteredCustomers = customers.filter((c) => {
    if (keyword === '') {
      return true;
    }
    return (
      c.name.toLowerCase().includes(keyword) ||
      (c.phone || '').toLowerCase().includes(keyword) ||
      (c.email || '').toLowerCase().includes(keyword)
    );
  });

  return (
    <>
      <div className={`settings-box ${className}`.trim()}>
        <ManagerGate isManager={isManager} title="Customer Directory" subject="customers">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <h6 className="mb-0 flex items-center gap-1">
              <Users size={16} aria-hidden="true" /> Customer Directory
            </h6>
            <button
              type="button"
              className="btn-primary-pos btn-sm-pos"
              onClick={openCustomerCreate}
            >
              <Plus size={14} aria-hidden="true" /> New Customer
            </button>
          </div>
          <p className="text-muted text-sm mb-3">
            Add, edit, or remove customers. The directory is saved in the browser, syncs to the
            cloud, and autocompletes names on the checkout screen.
          </p>

          <div className="search-wrap mb-3">
            <Search size={15} className="search-icon" aria-hidden="true" />
            <input
              type="text"
              className="search-input w-full"
              placeholder="Search customers…"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="table-pos menu-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Tier</th>
                  <th>Visits</th>
                  <th>Total Spent</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <div>
                          <span>{customer.name}</span>
                          {customer.email ? (
                            <div className="text-muted text-sm">{customer.email}</div>
                          ) : null}
                        </div>
                      </td>
                      <td>{customer.phone || '—'}</td>
                      <td>{customer.tier}</td>
                      <td>{customer.visits}</td>
                      <td>{formatPeso(customer.total_spent)}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="btn-outline-primary-pos btn-sm-pos"
                            onClick={() => openCustomerEdit(customer)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-outline-danger-pos btn-sm-pos"
                            onClick={() => handleDeleteCustomer(customer)}
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-3">
                      No customers match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ManagerGate>
      </div>

      {customerEditor ? (
        <CustomerEditorModal
          editor={customerEditor}
          error={customerEditorError}
          onFieldChange={onFieldChange}
          onClose={() => setCustomerEditor(null)}
          onSubmit={handleSaveCustomer}
        />
      ) : null}
    </>
  );
}
