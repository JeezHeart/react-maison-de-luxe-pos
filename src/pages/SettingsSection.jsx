import { useState } from 'react';
import {
  Settings,
  Plus,
  Pencil,
  X,
  Search,
  Trash2,
} from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore.js';
import { useOrderStore, USER_COUNT } from '../stores/orderStore.js';
import { useUIStore } from '../stores/uiStore.js';
import { useMenuStore } from '../stores/menuStore.js';
import { useAuthStore } from '../stores/authStore.js';
import { getMenuImagePath } from '../utils/menu.js';
import { formatPeso } from '../utils/format.js';

const EMPTY_EDITOR = { name: '', category: '', description: '', price: '', stock: '' };

// Settings section — restaurant profile (browser storage), system
// snapshot, and (manager-only) menu management for items/categories.
export default function SettingsSection() {
  const saved = useSettingsStore();
  const saveSettings = useSettingsStore((s) => s.save);
  const resetSettings = useSettingsStore((s) => s.reset);
  const showToast = useUIStore((s) => s.showToast);
  const orders = useOrderStore((s) => s.orders);

  const menuItems = useMenuStore((s) => s.items);
  const menuCategories = useMenuStore((s) => s.categories);
  const addItem = useMenuStore((s) => s.addItem);
  const updateItem = useMenuStore((s) => s.updateItem);
  const deleteItem = useMenuStore((s) => s.deleteItem);
  const addCategory = useMenuStore((s) => s.addCategory);
  const renameCategory = useMenuStore((s) => s.renameCategory);
  const deleteCategory = useMenuStore((s) => s.deleteCategory);
  const resetMenu = useMenuStore((s) => s.reset);

  const currentUser = useAuthStore((s) => s.currentUser);
  const isManager = currentUser && currentUser.role === 'manager';

  const [restaurantName, setRestaurantName] = useState(saved.restaurantName);
  const [contact, setContact] = useState(saved.contact);
  const [address, setAddress] = useState(saved.address);

  // Menu management state.
  const [menuSearch, setMenuSearch] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [renamingCat, setRenamingCat] = useState(null);
  const [catRenameValue, setCatRenameValue] = useState('');
  const [editor, setEditor] = useState(null); // { mode: 'create' | 'edit', item: {...} }
  const [editorError, setEditorError] = useState('');

  const handleSave = () => {
    saveSettings({ restaurantName, contact, address });
    showToast('Settings saved successfully.');
  };

  const handleReset = () => {
    resetSettings();
    setRestaurantName('Maison de Luxe');
    setContact('');
    setAddress('');
    showToast('Settings reset.');
  };

  // ---- menu item editor ----
  const openCreate = () => {
    setEditor({ mode: 'create', item: { ...EMPTY_EDITOR, category: menuCategories[0] || '' } });
    setEditorError('');
  };

  const openEdit = (item) => {
    setEditor({
      mode: 'edit',
      item: { ...item, price: String(item.price), stock: String(item.stock) },
    });
    setEditorError('');
  };

  const handleSaveItem = (e) => {
    e.preventDefault();
    const data = editor.item;
    const name = String(data.name || '').trim();
    const price = Number(data.price);
    if (!name) {
      setEditorError('Item name is required.');
      return;
    }
    if (!data.category) {
      setEditorError('Choose a category.');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setEditorError('Price must be greater than zero.');
      return;
    }
    const payload = {
      name,
      category: data.category,
      description: data.description,
      price,
      stock: Number(data.stock) || 0,
    };
    if (editor.mode === 'create') {
      const created = addItem(payload);
      if (created) {
        showToast(`"${created.name}" added to the menu.`);
        setEditor(null);
      }
    } else {
      updateItem(editor.item.id, payload);
      showToast('Menu item updated.');
      setEditor(null);
    }
  };

  const handleDeleteItem = (item) => {
    if (window.confirm(`Delete "${item.name}" from the menu? This cannot be undone.`)) {
      deleteItem(item.id);
      showToast(`"${item.name}" removed from the menu.`);
    }
  };

  // ---- categories ----
  const handleAddCategory = () => {
    if (addCategory(newCategory)) {
      setNewCategory('');
      showToast('Category added.');
    } else {
      showToast(newCategory.trim() ? 'Category already exists.' : 'Enter a category name.');
    }
  };

  const commitRename = () => {
    if (renamingCat === null) {
      return;
    }
    if (renameCategory(renamingCat, catRenameValue)) {
      showToast('Category renamed.');
    } else if (catRenameValue.trim()) {
      showToast('Category name already in use.');
    }
    setRenamingCat(null);
  };

  const handleDeleteCategory = (cat) => {
    if (deleteCategory(cat)) {
      showToast(`Category "${cat}" removed.`);
    } else {
      showToast(`Cannot delete "${cat}" — it still has menu items.`);
    }
  };

  const handleResetMenu = () => {
    if (window.confirm('Restore the default menu? Your custom items and categories will be replaced.')) {
      resetMenu();
      showToast('Default menu restored.');
    }
  };

  const filteredMenuItems = menuItems.filter((m) => {
    const kw = menuSearch.trim().toLowerCase();
    return kw === '' || m.name.toLowerCase().includes(kw) || m.category.toLowerCase().includes(kw);
  });

  return (
    <div id="settingsSection" className="main-section active-section">
      <div className="mb-3">
        <h4 className="section-title m-0 flex items-center gap-1">
          <Settings size={26} aria-hidden="true" /> Settings
        </h4>
        <small className="text-muted">Project tips and maintenance notes.</small>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 lg:col-span-7">
          <div className="settings-box h-full">
            <h6 className="mb-2">Restaurant Profile</h6>
            <p className="text-muted text-sm mb-3">
              Save branding details used in this POS dashboard (saved in browser).
            </p>

            <div className="mb-2">
              <label htmlFor="settingRestaurantName" className="field-label">
                Restaurant Name
              </label>
              <input
                type="text"
                id="settingRestaurantName"
                className="field-control"
                placeholder="Maison de Luxe"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
              />
            </div>
            <div className="mb-2">
              <label htmlFor="settingContact" className="field-label">
                Contact Number
              </label>
              <input
                type="text"
                id="settingContact"
                className="field-control"
                placeholder="+63 912 345 6789"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="settingAddress" className="field-label">
                Address
              </label>
              <input
                type="text"
                id="settingAddress"
                className="field-control"
                placeholder="City, Country"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                id="saveSettingsBtn"
                className="btn-primary-pos btn-sm-pos"
                onClick={handleSave}
              >
                Save Settings
              </button>
              <button
                type="button"
                id="resetSettingsBtn"
                className="btn-outline-secondary-pos btn-sm-pos"
                onClick={handleReset}
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <div className="settings-box mb-3">
            <h6 className="mb-2">System Snapshot</h6>
            <div className="text-sm flex justify-between mb-1">
              <span className="text-muted">Total Users</span>
              <strong>{USER_COUNT}</strong>
            </div>
            <div className="text-sm flex justify-between mb-1">
              <span className="text-muted">Menu Items</span>
              <strong>{menuItems.length}</strong>
            </div>
            <div className="text-sm flex justify-between">
              <span className="text-muted">Orders</span>
              <strong>{orders.length}</strong>
            </div>
          </div>

          <div className="settings-box">
            <h6 className="mb-2">Quick Reminders</h6>
            <ul className="text-sm text-muted mb-0 settings-list">
              <li>
                Store images in <strong>assets/images</strong>
              </li>
              <li>Clear browser storage to reset orders &amp; settings</li>
              <li>Runs as a static app — no database required</li>
              <li>
                Use clear image names like <strong>grilled-steak.jpg</strong>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Manager-only menu management */}
      <div className="settings-box mt-3">
        {isManager ? (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <h6 className="mb-0">Menu Management</h6>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-outline-secondary-pos btn-sm-pos"
                  onClick={handleResetMenu}
                >
                  Restore Default Menu
                </button>
                <button type="button" className="btn-primary-pos btn-sm-pos" onClick={openCreate}>
                  <Plus size={14} aria-hidden="true" /> New Item
                </button>
              </div>
            </div>
            <p className="text-muted text-sm mb-3">
              Add, edit, or remove menu items and categories. Changes are saved in the browser
              and update the dashboard immediately.
            </p>

            {/* Categories */}
            <div className="menu-cats mb-3">
              <span className="text-muted text-sm d-inline-block mr-2 mb-1">Categories:</span>
              {menuCategories.map((cat) => (
                <span key={cat} className="menu-cat-chip">
                  {renamingCat === cat ? (
                    <input
                      className="menu-cat-rename-input"
                      value={catRenameValue}
                      autoFocus
                      onChange={(e) => setCatRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') setRenamingCat(null);
                      }}
                    />
                  ) : (
                    <span className="menu-cat-name">{cat}</span>
                  )}
                  <button
                    type="button"
                    className="menu-cat-mini-btn"
                    title="Rename category"
                    onClick={() => {
                      setRenamingCat(cat);
                      setCatRenameValue(cat);
                    }}
                  >
                    <Pencil size={12} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="menu-cat-mini-btn"
                    title="Delete category"
                    onClick={() => handleDeleteCategory(cat)}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>

            {/* Add category */}
            <div className="flex flex-col md:flex-row gap-2 mb-3">
              <input
                type="text"
                className="field-control"
                placeholder="New category name"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCategory();
                  }
                }}
              />
              <button
                type="button"
                className="btn-outline-secondary-pos btn-sm-pos"
                onClick={handleAddCategory}
              >
                Add Category
              </button>
            </div>

            {/* Item search + list */}
            <div className="search-wrap mb-3">
              <Search size={15} className="search-icon" aria-hidden="true" />
              <input
                type="text"
                className="search-input w-full"
                placeholder="Search menu items…"
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="table-pos menu-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMenuItems.length > 0 ? (
                    filteredMenuItems.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <img
                              src={getMenuImagePath(item.name)}
                              alt={item.name}
                              className="order-item-thumb"
                            />
                            <span>{item.name}</span>
                          </div>
                        </td>
                        <td>{item.category}</td>
                        <td>{formatPeso(item.price)}</td>
                        <td>{item.stock}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="btn-outline-primary-pos btn-sm-pos"
                              onClick={() => openEdit(item)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn-outline-danger-pos btn-sm-pos"
                              onClick={() => handleDeleteItem(item)}
                            >
                              <Trash2 size={13} aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-3">
                        No menu items match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <h6 className="mb-2">Menu Management</h6>
            <p className="text-muted text-sm m-0">
              Only managers can add, edit, or delete menu items and categories. Ask a manager to
              sign in to make changes.
            </p>
          </>
        )}
      </div>

      {/* Menu item editor modal */}
      {editor ? (
        <div className="modal-overlay" onClick={() => setEditor(null)}>
          <div
            className="product-modal-content menu-editor-modal p-3 md:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Menu item editor"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h6 className="m-0">{editor.mode === 'create' ? 'Add Menu Item' : 'Edit Menu Item'}</h6>
              <button
                type="button"
                className="modal-close-btn"
                aria-label="Close"
                onClick={() => setEditor(null)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleSaveItem}>
              <div className="mb-2">
                <label className="field-label" htmlFor="menuItemName">
                  Name
                </label>
                <input
                  id="menuItemName"
                  type="text"
                  className="field-control"
                  value={editor.item.name}
                  onChange={(e) =>
                    setEditor({ ...editor, item: { ...editor.item, name: e.target.value } })
                  }
                />
              </div>
              <div className="mb-2">
                <label className="field-label" htmlFor="menuItemCategory">
                  Category
                </label>
                <select
                  id="menuItemCategory"
                  className="field-control"
                  value={editor.item.category}
                  onChange={(e) =>
                    setEditor({ ...editor, item: { ...editor.item, category: e.target.value } })
                  }
                >
                  {menuCategories.map((cat) => (
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
                  value={editor.item.description}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      item: { ...editor.item, description: e.target.value },
                    })
                  }
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
                    value={editor.item.price}
                    onChange={(e) =>
                      setEditor({ ...editor, item: { ...editor.item, price: e.target.value } })
                    }
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
                    value={editor.item.stock}
                    onChange={(e) =>
                      setEditor({ ...editor, item: { ...editor.item, stock: e.target.value } })
                    }
                  />
                </div>
              </div>
              {editorError ? <p className="form-error text-sm mb-2">{editorError}</p> : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-outline-secondary-pos btn-sm-pos"
                  onClick={() => setEditor(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary-pos btn-sm-pos">
                  {editor.mode === 'create' ? 'Add Item' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}