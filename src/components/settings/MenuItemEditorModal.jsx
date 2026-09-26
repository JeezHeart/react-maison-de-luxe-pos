import { X } from 'lucide-react';

// Add/edit form for a menu item. Presentational on purpose: the owning card
// holds the draft and does the saving, so this file only renders fields.
export default function MenuItemEditorModal({
  editor,
  categories,
  error,
  onFieldChange,
  onClose,
  onSubmit,
}) {
  const { mode, item } = editor;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="product-modal-content menu-editor-modal p-3 md:p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Menu item editor"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h6 className="m-0">{mode === 'create' ? 'Add Menu Item' : 'Edit Menu Item'}</h6>
          <button type="button" className="modal-close-btn" aria-label="Close" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="mb-2">
            <label className="field-label" htmlFor="menuItemName">
              Name
            </label>
            <input
              id="menuItemName"
              type="text"
              className="field-control"
              value={item.name}
              onChange={(e) => onFieldChange('name', e.target.value)}
            />
          </div>
          <div className="mb-2">
            <label className="field-label" htmlFor="menuItemCategory">
              Category
            </label>
            <select
              id="menuItemCategory"
              className="field-control"
              value={item.category}
              onChange={(e) => onFieldChange('category', e.target.value)}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-2">
            <label className="field-label" htmlFor="menuItemDescription">
              Description
            </label>
            <textarea
              id="menuItemDescription"
              rows={2}
              className="field-control"
              value={item.description}
              onChange={(e) => onFieldChange('description', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="field-label" htmlFor="menuItemPrice">
                Price (₱)
              </label>
              <input
                id="menuItemPrice"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="field-control"
                value={item.price}
                onChange={(e) => onFieldChange('price', e.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="menuItemStock">
                Stock
              </label>
              <input
                id="menuItemStock"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                className="field-control"
                value={item.stock}
                onChange={(e) => onFieldChange('stock', e.target.value)}
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
              {mode === 'create' ? 'Add Item' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
