import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useMenuStore, LOW_STOCK_THRESHOLD } from '../stores/menuStore.js';
import { useCartStore } from '../stores/cartStore.js';
import { useUIStore } from '../stores/uiStore.js';
import { getMenuImagePath } from '../utils/menu.js';
import { formatPeso } from '../utils/format.js';

// Dashboard / Menu section — search, category filter, food cards and the
// product detail modal. Items and categories come from the live menu
// store so manager edits in Settings show up here immediately.
export default function DashboardSection() {
  const menuItems = useMenuStore((s) => s.items);
  const menuCategories = useMenuStore((s) => s.categories);
  const addToCart = useCartStore((s) => s.addToCart);
  const setSelectedProduct = useUIStore((s) => s.setSelectedProduct);
  const toggleMobileInvoice = useUIStore((s) => s.toggleMobileInvoice);
  const mobileInvoiceVisible = useUIStore((s) => s.mobileInvoiceVisible);

  const [activeCategory, setActiveCategory] = useState('Breakfast');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showCategories, setShowCategories] = useState(true);

  // Fall back to the first available category if the selected one was
  // renamed or deleted by a manager.
  const activeCat = menuCategories.includes(activeCategory)
    ? activeCategory
    : menuCategories[0] || '';

  const visibleItems = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    return menuItems.filter((item) => {
      const categoryMatch = item.category === activeCat;
      const searchMatch = keyword === '' || item.name.toLowerCase().includes(keyword);
      return categoryMatch && searchMatch;
    });
  }, [menuItems, activeCat, searchKeyword]);

  const sectionTitle = `${activeCat.toUpperCase()} MENU`;

  const handleCategoryClick = (category) => {
    setActiveCategory(category);
  };

  return (
    <div id="dashboardSection" className="main-section active-section">
      {/* Top navigation / search */}
      <div className="dashboard-topbar flex flex-col xl:flex-row justify-between items-center gap-3 mb-3">
        <div className="search-wrap w-full xl:w-auto">
          <Search size={15} className="search-icon" aria-hidden="true" />
          <input
            type="text"
            id="searchInput"
            className="search-input w-full"
            placeholder="Search Your Menu Here"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
        </div>
        <div className="top-actions flex items-center gap-3">
          <button
            type="button"
            id="toggleCategoriesBtn"
            className="btn-outline-secondary-pos"
            onClick={() => setShowCategories((v) => !v)}
          >
            Categories
          </button>
        </div>
      </div>

      {/* Category buttons */}
      <div className={`slide-region mb-4 ${showCategories ? '' : 'closed'}`}>
        <div className="slide-inner">
          <div id="categorySection" className="category-grid">
            {menuCategories.map((catName) => (
              <button
                key={catName}
                type="button"
                className={`category-btn ${catName === activeCat ? 'active-category' : ''}`}
                onClick={() => handleCategoryClick(catName)}
              >
                <div className="cat-title">{catName.toUpperCase()}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h4 id="menuSectionTitle" className="section-title m-0">
          {sectionTitle}
        </h4>
        <button
          type="button"
          id="toggleInvoiceBtn"
          className="btn-outline-secondary-pos lg:hidden"
          onClick={toggleMobileInvoice}
        >
          {mobileInvoiceVisible ? 'Hide Invoice' : 'Show Invoice'}
        </button>
      </div>

      {/* Food cards */}
      <div id="menuGrid" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" key={`${activeCat}-${searchKeyword}`}>
        {visibleItems.length > 0 ? (
          visibleItems.map((item, index) => {
            const stock = Number(item.stock) || 0;
            const badgeClass =
              stock === 0
                ? 'stock-badge stock-out'
                : stock <= LOW_STOCK_THRESHOLD
                  ? 'stock-badge stock-low'
                  : 'stock-badge stock-ok';
            const badgeText =
              stock === 0
                ? 'Out of Stock'
                : stock <= LOW_STOCK_THRESHOLD
                  ? `Low · ${stock} left`
                  : `${stock} in stock`;
            return (
              <div
                key={item.id}
                className="menu-card-wrapper stagger-card"
                style={{ animationDelay: `${index * 45}ms` }}
              >
                <div
                  className={`food-card h-full product-click-card ${stock === 0 ? 'stock-empty' : ''}`}
                  onClick={() => setSelectedProduct(item)}
                >
                  <span className={badgeClass}>{badgeText}</span>
                  <img
                    src={getMenuImagePath(item.name)}
                    className="food-img"
                    alt={item.name}
                    loading="lazy"
                  />
                  <div className="food-content">
                    <h6 className="food-title">{item.name}</h6>
                    <p className="food-desc">{item.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="food-price">{formatPeso(item.price)}</span>
                      <button
                        type="button"
                        className="add-btn add-to-cart-btn"
                        disabled={stock === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(item.id, item.name, item.price, '');
                        }}
                      >
                        {stock === 0 ? 'Sold Out' : '+ Add'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full">
            <p className="text-muted text-sm">
              No menu items found{searchKeyword ? ` for "${searchKeyword}"` : ''}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}