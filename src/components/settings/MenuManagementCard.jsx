import { useState } from 'react';
import { Plus, Pencil, X, Search, Trash2 } from 'lucide-react';
import { useMenuStore } from '../../stores/menuStore.js';
import { useUIStore } from '../../stores/uiStore.js';
import { getMenuImagePath } from '../../utils/menu.js';
import { formatPeso } from '../../utils/format.js';
import { validateMenuItem } from '../../utils/menuItemValidation.js';
import ManagerGate from './ManagerGate.jsx';
import MenuItemEditorModal from './MenuItemEditorModal.jsx';

const EMPTY_EDITOR = { name: '', category: '', description: '', price: '', stock: '' };

// Manager-only menu management: categories, and the searchable item table.
// Owns the editor draft and all the CRUD wiring for this panel.
export default function MenuManagementCard({ isManager, className = '' }) {
  const menuItems = useMenuStore((s) => s.items);
  const menuCategories = useMenuStore((s) => s.categories);
  const addItem = useMenuStore((s) => s.addItem);
  const updateItem = useMenuStore((s) => s.updateItem);
  const deleteItem = useMenuStore((s) => s.deleteItem);
  const restoreItem = useMenuStore((s) => s.restoreItem);
  const addCategory = useMenuStore((s) => s.addCategory);
  const renameCategory = useMenuStore((s) => s.renameCategory);
  const deleteCategory = useMenuStore((s) => s.deleteCategory);
  const resetMenu = useMenuStore((s) => s.reset);
  const showToast = useUIStore((s) => s.showToast);

  const [menuSearch, setMenuSearch] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [renamingCat, setRenamingCat] = useState(null);
  const [catRenameValue, setCatRenameValue] = useState('');
  const [editor, setEditor] = useState(null); // { mode: 'create' | 'edit', item }
  const [editorError, setEditorError] = useState('');

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

  // Functional update so typing cannot race a stale `editor` closure.
  const onFieldChange = (field, value) => {
    setEditor((prev) => ({ ...prev, item: { ...prev.item, [field]: value } }));
  };

  const handleSaveItem = (e) => {
    e.preventDefault();
    const { error, payload } = validateMenuItem(editor.item);
    if (error) {
      setEditorError(error);
      return;
    }
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
    if (window.confirm(`Delete "${item.name}" from the menu? You can undo this right away.`)) {
      deleteItem(item.id);
      // Short window to undo before the cloud delete sticks.
      showToast(`"${item.name}" removed from the menu.`, 4000, {
        label: 'Undo',
        onClick: () => restoreItem(item),
      });
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

  const keyword = menuSearch.trim().toLowerCase();
  const filteredMenuItems = menuItems.filter(
    (m) => keyword === '' || m.name.toLowerCase().includes(keyword) || m.category.toLowerCase().includes(keyword)
  );

  return (
    <>
      <div className={`settings-box ${className}`.trim()}>
        <ManagerGate
          isManager={isManager}
          title="Menu Management"
          subject="menu items and categories"
        >
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
        </ManagerGate>
      </div>

      {editor ? (
        <MenuItemEditorModal
          editor={editor}
          categories={menuCategories}
          error={editorError}
          onFieldChange={onFieldChange}
          onClose={() => setEditor(null)}
          onSubmit={handleSaveItem}
        />
      ) : null}
    </>
  );
}
