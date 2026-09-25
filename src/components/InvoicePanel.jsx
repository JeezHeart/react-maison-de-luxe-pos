import { useMemo, useState } from 'react';
import { useCartStore } from '../stores/cartStore.js';
import { useOrderStore } from '../stores/orderStore.js';
import { useCustomerStore } from '../stores/customerStore.js';
import { useUIStore } from '../stores/uiStore.js';
import { formatPeso, round2 } from '../utils/format.js';

const PAYMENT_METHODS = ['Credit Card', 'Paylater', 'Cash Payout', 'GCash', 'Maya'];
const ORDER_TYPES = ['Dine-in', 'Takeout', 'Delivery'];

const DISCOUNT_OPTIONS = [
  { value: 'none', label: 'No Discount' },
  { value: 'senior', label: 'Senior & PWD (20%)' },
  { value: 'fixed', label: 'Fixed Amount (₱)' },
  { value: 'percent', label: 'Percentage (%)' },
];

// Right-hand invoice column (dashboard only) — live cart, tax,
// customer name, payment method and place-order form, plus recent orders.
export default function InvoicePanel() {
  const items = useCartStore((s) => s.items);
  const changeQty = useCartStore((s) => s.changeQty);
  const clear = useCartStore((s) => s.clear);

  const orders = useOrderStore((s) => s.orders);
  const placeOrder = useOrderStore((s) => s.placeOrder);

  const customers = useCustomerStore((s) => s.customers);

  const showToast = useUIStore((s) => s.showToast);
  const mobileInvoiceVisible = useUIStore((s) => s.mobileInvoiceVisible);

  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [paymentMethod, setPaymentMethod] = useState('Credit Card');
  const [orderType, setOrderType] = useState('Dine-in');
  const [discountType, setDiscountType] = useState('none');
  const [discountValue, setDiscountValue] = useState('');
  const [cashTendered, setCashTendered] = useState('');
  const [shaking, setShaking] = useState(false);

  const subTotal = useMemo(
    () => items.reduce((acc, item) => acc + item.qty * item.price, 0),
    [items]
  );

  const discountAmount = useMemo(() => {
    if (discountType === 'senior') {
      return round2(subTotal * 0.2);
    }
    if (discountType === 'fixed') {
      const v = Number(discountValue);
      if (!Number.isFinite(v) || v <= 0) return 0;
      return Math.min(round2(v), subTotal);
    }
    if (discountType === 'percent') {
      const v = Number(discountValue);
      if (!Number.isFinite(v) || v <= 0) return 0;
      const pct = Math.min(100, v);
      return round2((subTotal * pct) / 100);
    }
    return 0;
  }, [discountType, discountValue, subTotal]);

  const taxable = subTotal - discountAmount;
  const tax = round2(taxable * 0.1);
  const total = round2(taxable + tax);

  const discountLabel =
    discountType === 'none' || discountAmount <= 0
      ? ''
      : discountType === 'senior'
        ? 'Senior & PWD (20%)'
        : discountType === 'fixed'
          ? 'Fixed Discount'
          : 'Percentage Discount';

  const isCash = paymentMethod === 'Cash Payout';
  const tenderedNum = isCash && cashTendered !== '' ? Number(cashTendered) : NaN;
  const change = Number.isFinite(tenderedNum) ? tenderedNum - total : null;
  const shortfall = change !== null && change < 0 ? -change : 0;

  const handlePlaceOrder = (e) => {
    e.preventDefault();
    if (items.length === 0) {
      showToast('Please add menu items before placing order.', 1400);
      setShaking(true);
      setTimeout(() => setShaking(false), 650);
      return;
    }
    if (isCash) {
      const tendered = Number(cashTendered);
      if (cashTendered === '' || !Number.isFinite(tendered) || tendered < total) {
        showToast('Cash tendered is less than the total.', 1400);
        setShaking(true);
        setTimeout(() => setShaking(false), 650);
        return;
      }
    }
    placeOrder({
      customerName,
      paymentMethod,
      orderType,
      items,
      subTotal,
      discountLabel,
      discountAmount,
      taxAmount: tax,
      totalAmount: total,
      cashTendered: isCash && Number.isFinite(tenderedNum) ? tenderedNum : null,
      changeAmount: isCash && change !== null ? Math.max(0, change) : null,
    });
    clear();
  };

  const recentOrders = orders.slice(0, 5);

  return (
    <div
      id="invoiceColumn"
      className={`col-span-12 lg:col-span-3 invoice-col ${mobileInvoiceVisible ? 'mobile-shown' : ''}`}
    >
      <div id="invoicePanel" className={`invoice-card p-3 md:p-4 ${shaking ? 'shake-x' : ''}`}>
        <h4 className="invoice-title">Invoice</h4>
        <div id="invoiceItems" className="invoice-items mb-3">
          {items.length === 0 ? (
            <p className="text-muted text-sm m-0">No items yet. Add from the menu.</p>
          ) : (
            items.map((item) => (
              <div key={`${item.id}-${item.addons}`} className="invoice-item">
                <div className="flex justify-between">
                  <div>
                    <div className="invoice-item-name">{item.name}</div>
                    <div className="invoice-item-sub">{formatPeso(item.price)} each</div>
                    {item.addons ? (
                      <div className="invoice-item-sub">Add-ons: {item.addons}</div>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <div>{formatPeso(item.qty * item.price)}</div>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <button
                        type="button"
                        className="qty-btn"
                        onClick={() => changeQty(item.id, -1)}
                        aria-label={`Decrease ${item.name}`}
                      >
                        −
                      </button>
                      <span>{item.qty}</span>
                      <button
                        type="button"
                        className="qty-btn"
                        onClick={() => changeQty(item.id, 1)}
                        aria-label={`Increase ${item.name}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="summary-row">
          <span>Sub Total</span>
          <strong>{formatPeso(subTotal)}</strong>
        </div>
        {discountAmount > 0 ? (
          <div className="summary-row">
            <span>Discount{discountLabel ? ` (${discountLabel})` : ''}</span>
            <strong>−{formatPeso(discountAmount)}</strong>
          </div>
        ) : null}
        <div className="summary-row">
          <span>Tax (10%)</span>
          <strong>{formatPeso(tax)}</strong>
        </div>
        <div className="summary-row total-row">
          <span>Total Payment</span>
          <strong>{formatPeso(total)}</strong>
        </div>
        {isCash && Number.isFinite(tenderedNum) ? (
          <div className="summary-row">
            <span>Cash Tendered</span>
            <strong>{formatPeso(tenderedNum)}</strong>
          </div>
        ) : null}
        {isCash && change !== null && change >= 0 ? (
          <div className="summary-row">
            <span>Change</span>
            <strong>{formatPeso(change)}</strong>
          </div>
        ) : null}
        {isCash && shortfall > 0 ? (
          <div className="summary-row" style={{ color: '#e07a5f' }}>
            <span>Short</span>
            <strong>{formatPeso(shortfall)}</strong>
          </div>
        ) : null}

        <form id="orderForm" className="mt-3" onSubmit={handlePlaceOrder}>
          <div className="mb-2">
            <label className="field-label" htmlFor="customerNameInput">
              Customer Name
            </label>
            <input
              id="customerNameInput"
              type="text"
              name="customer_name"
              className="field-control"
              list="customer-name-list"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <datalist id="customer-name-list">
              {customers.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </div>

          <div className="mb-3">
            <label className="field-label mb-1">Order Type</label>
            <div className="payment-tabs flex gap-2">
              {ORDER_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`payment-tab ${orderType === type ? 'active-payment' : ''}`}
                  onClick={() => setOrderType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-2">
            <label className="field-label mb-1">Discount</label>
            <select
              className="field-control"
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value)}
            >
              {DISCOUNT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {discountType === 'fixed' || discountType === 'percent' ? (
            <div className="mb-3">
              <label className="field-label">
                {discountType === 'fixed' ? 'Discount Amount (₱)' : 'Discount Percent (%)'}
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="field-control"
                placeholder={discountType === 'fixed' ? '0.00' : '5'}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
              />
            </div>
          ) : null}

          <div className="mb-3">
            <label className="field-label mb-1">Payment Method</label>
            <div className="payment-tabs flex gap-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  className={`payment-tab ${paymentMethod === method ? 'active-payment' : ''}`}
                  onClick={() => setPaymentMethod(method)}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {isCash && (
            <div className="mb-3">
              <label className="field-label">Cash Tendered</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="field-control"
                placeholder="0.00"
                value={cashTendered}
                onChange={(e) => setCashTendered(e.target.value)}
              />
            </div>
          )}

          <button type="submit" id="placeOrderBtn" className="place-order-btn w-full">
            Place An Order
          </button>
        </form>

        <div className="history-box mt-4">
          <h6 className="mb-2">Recent Orders</h6>
          {recentOrders.length > 0 ? (
            recentOrders.map((history) => (
              <div key={history.id} className="history-item">
                <div className="flex justify-between">
                  <span>
                    #{history.id} - {history.customer_name}
                  </span>
                  <strong>{formatPeso(history.total_amount)}</strong>
                </div>
                <small className="text-muted">
                  {history.payment_method} | {history.order_type || 'Dine-in'} |{' '}
                  {history.created_at}
                </small>
              </div>
            ))
          ) : (
            <p className="text-muted text-sm m-0">No order history yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}