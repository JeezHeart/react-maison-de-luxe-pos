import { X } from 'lucide-react';
import { useUIStore } from '../stores/uiStore.js';
import { useCartStore } from '../stores/cartStore.js';
import { useMenuStore, LOW_STOCK_THRESHOLD } from '../stores/menuStore.js';
import { getAddOnsForProduct } from '../data/addons.js';
import { getNutrition } from '../utils/menu.js';
import { formatPeso } from '../utils/format.js';

// Product detail modal — live add-on total and "Add To Invoice" flow.
export default function ProductDetailModal() {
  const product = useUIStore((s) => s.selectedProduct);
  const selectedAddOns = useUIStore((s) => s.selectedAddOns);
  const toggleAddOn = useUIStore((s) => s.toggleAddOn);
  const clearSelectedProduct = useUIStore((s) => s.clearSelectedProduct);
  const addToCart = useCartStore((s) => s.addToCart);

  if (!product) {
    return null;
  }

  const addOns = getAddOnsForProduct(product.name);
  const addOnTotal = selectedAddOns.reduce((sum, a) => sum + a.price, 0);
  const liveTotal = product.price + addOnTotal;
  const nutrition = getNutrition(product);
  const stock = Number(product.stock) || 0;
  const outOfStock = stock <= 0;
  const lowStock = !outOfStock && stock <= LOW_STOCK_THRESHOLD;

  const labels = selectedAddOns.map((a) => a.label).join(', ');

  const handleAddToInvoice = () => {
    addToCart(product.id, product.name, liveTotal, labels);
    clearSelectedProduct();
  };

  return (
    <div className="modal-overlay" onClick={clearSelectedProduct}>
      <div
        className="product-modal-content p-3 md:p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Product Details"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h6 className="m-0">Product Details</h6>
          <button
            type="button"
            className="modal-close-btn"
            aria-label="Close"
            onClick={clearSelectedProduct}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center justify-between mb-2">
          <span
            className={`text-sm font-semibold ${
              outOfStock ? 'stock-out-text' : lowStock ? 'stock-low-text' : 'text-muted'
            }`}
          >
            {outOfStock
              ? 'Out of Stock'
              : lowStock
                ? `Low Stock · ${stock} left`
                : `${stock} in stock`}
          </span>
        </div>

        <div className="flex items-center justify-between mb-2">
          <span className="text-muted text-sm">{product.category}</span>
          <strong>{formatPeso(product.price)}</strong>
        </div>
        <h5 className="mb-1">{product.name}</h5>
        <p className="text-muted text-sm mb-3">{product.description}</p>

        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted">1 Serving</span>
          <span className="text-sm">
            <strong>{nutrition.calories}</strong> Kcal
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="nutrition-box">
            <div className="text-sm text-muted">Carbs</div>
            <div className="font-bold">
              <span>{nutrition.carbs}</span> gr
            </div>
          </div>
          <div className="nutrition-box">
            <div className="text-sm text-muted">Protein</div>
            <div className="font-bold">
              <span>{nutrition.protein}</span> gr
            </div>
          </div>
          <div className="nutrition-box">
            <div className="text-sm text-muted">Fat</div>
            <div className="font-bold">
              <span>{nutrition.fat}</span> gr
            </div>
          </div>
        </div>

        <div className="ingredients-card mb-3">
          <h6 className="mb-2">Ingredients</h6>
          <p className="text-muted text-sm m-0">{product.description}</p>
        </div>

        <div className="ingredients-card mb-3">
          <h6 className="mb-2">Add-ons</h6>
          {addOns.length === 0 ? (
            <div className="text-muted text-sm">No add-ons available.</div>
          ) : (
            <div>
              {addOns.map((addon) => {
                const checked = selectedAddOns.some((a) => a.id === addon.id);
                return (
                  <label key={addon.id} className="addon-row">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="addon-checkbox"
                        checked={checked}
                        onChange={() => toggleAddOn(addon)}
                      />
                      <span>{addon.label}</span>
                    </span>
                    <strong>+₱{addon.price.toFixed(2)}</strong>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted">Item Total</span>
          <strong>{formatPeso(liveTotal)}</strong>
        </div>

        <button
          type="button"
          className="place-order-btn w-full"
          onClick={handleAddToInvoice}
          disabled={outOfStock}
        >
          {outOfStock ? 'Out of Stock' : 'Add To Invoice'}
        </button>
      </div>
    </div>
  );
}