import { X } from 'lucide-react';
import { CUSTOMER_TIERS } from '../../data/customers.js';

// Add/edit form for a customer. Presentational on purpose: the owning card
// holds the draft and does the saving.
export default function CustomerEditorModal({
  editor,
  error,
  onFieldChange,
  onClose,
  onSubmit,
}) {
  const { mode, customer } = editor;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="product-modal-content menu-editor-modal p-3 md:p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Customer editor"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h6 className="m-0">{mode === 'create' ? 'Add Customer' : 'Edit Customer'}</h6>
          <button type="button" className="modal-close-btn" aria-label="Close" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="mb-2">
            <label className="field-label" htmlFor="customerName">
              Name
            </label>
            <input
              id="customerName"
              type="text"
              className="field-control"
              value={customer.name}
              onChange={(e) => onFieldChange('name', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="field-label" htmlFor="customerPhone">
                Phone
              </label>
              <input
                id="customerPhone"
                type="text"
                className="field-control"
                placeholder="+63 912 345 6789"
                value={customer.phone}
                onChange={(e) => onFieldChange('phone', e.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="customerTier">
                Tier
              </label>
              <select
                id="customerTier"
                className="field-control"
                value={customer.tier}
                onChange={(e) => onFieldChange('tier', e.target.value)}
              >
                {CUSTOMER_TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mb-2">
            <label className="field-label" htmlFor="customerEmail">
              Email
            </label>
            <input
              id="customerEmail"
              type="email"
              className="field-control"
              placeholder="customer@example.com"
              value={customer.email}
              onChange={(e) => onFieldChange('email', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="field-label" htmlFor="customerVisits">
                Visits
              </label>
              <input
                id="customerVisits"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                className="field-control"
                value={customer.visits}
                onChange={(e) => onFieldChange('visits', e.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="customerTotalSpent">
                Total Spent (₱)
              </label>
              <input
                id="customerTotalSpent"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="field-control"
                value={customer.total_spent}
                onChange={(e) => onFieldChange('total_spent', e.target.value)}
              />
            </div>
          </div>
          {error ? <p className="form-error text-sm mb-2">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-outline-secondary-pos btn-sm-pos"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary-pos btn-sm-pos">
              {mode === 'create' ? 'Add Customer' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
