import { useParams } from 'react-router-dom';
import { useOrderStore } from '../stores/orderStore.js';
import { formatPeso } from '../utils/format.js';

const receiptStyles = `
  .receipt-page { font-family: Georgia, "Times New Roman", serif; max-width: 420px; margin: 24px auto; padding: 16px; color: #111; background: #fff; min-height: 100vh; }
  .receipt-page h1 { font-size: 1.25rem; margin: 0 0 8px; }
  .receipt-muted { color: #555; font-size: 0.85rem; }
  .receipt-table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 0.9rem; }
  .receipt-table th, .receipt-table td { text-align: left; padding: 6px 0; border-bottom: 1px solid #ddd; }
  .receipt-totals { margin-top: 12px; font-size: 0.95rem; }
  .receipt-totals div { display: flex; justify-content: space-between; margin: 4px 0; }
  .receipt-actions { margin-top: 20px; }
  .receipt-actions button { padding: 8px 22px; border-radius: 6px; border: 1px solid #999; background: #f5f5f5; cursor: pointer; font-family: Georgia, serif; }
  @media print {
    .receipt-actions { display: none; }
    .receipt-page { margin: 0; background: #fff; }
    body { background: #fff !important; background-image: none !important; }
  }
`;

// Printable receipt view — also used for printing.
export default function ReceiptPage() {
  const { id } = useParams();
  const orderId = Number(id);
  const order = useOrderStore((s) => s.getOrder(orderId));

  if (!order) {
    return (
      <div className="receipt-page" style={{ textAlign: 'center', paddingTop: '60px' }}>
        <style>{receiptStyles}</style>
        <h1>Maison de Luxe</h1>
        <div className="receipt-muted">Receipt #{(Number.isFinite(orderId) ? orderId : '?')}</div>
        <p>Order not found.</p>
      </div>
    );
  }

  const grand = Number(order.total_amount) || 0;
  const hasBreakdown = order.sub_total != null && order.tax_amount != null;
  const sub = hasBreakdown ? Number(order.sub_total) : grand / 1.1;
  const tax = hasBreakdown ? Number(order.tax_amount) : grand - sub;
  const discount = Number(order.discount_amount) || 0;
  const cashTendered = order.cash_tendered != null ? Number(order.cash_tendered) : null;
  const changeAmount = order.change_amount != null ? Number(order.change_amount) : null;

  return (
    <div className="receipt-page">
      <style>{receiptStyles}</style>
      <h1>Maison de Luxe</h1>
      <div className="receipt-muted">
        Receipt #{order.id} · {order.created_at}
      </div>
      <p className="receipt-muted">
        Customer: {order.customer_name}
        <br />
        Order Type: {order.order_type || 'Dine-in'}
        <br />
        Cashier: {order.cashier_name || 'N/A'}
        <br />
        Status: {order.order_status}
      </p>

      <table className="receipt-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {(order.items || []).map((it, i) => (
            <tr key={i}>
              <td>
                {it.name}
                <br />
                <span className="receipt-muted">{formatPeso(it.unit_price)} ea.</span>
              </td>
              <td>{it.quantity}</td>
              <td>{formatPeso(it.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="receipt-totals">
        <div>
          <span>Subtotal</span>
          <span>{formatPeso(sub)}</span>
        </div>
        {discount > 0 ? (
          <div>
            <span>Discount{order.discount_label ? ` (${order.discount_label})` : ''}</span>
            <span>−{formatPeso(discount)}</span>
          </div>
        ) : null}
        <div>
          <span>Tax (10%)</span>
          <span>{formatPeso(tax)}</span>
        </div>
        <div>
          <strong>Total</strong>
          <strong>{formatPeso(grand)}</strong>
        </div>
        <div>
          <span>Payment</span>
          <span>{order.payment_method}</span>
        </div>
        {cashTendered != null ? (
          <div>
            <span>Cash Tendered</span>
            <span>{formatPeso(cashTendered)}</span>
          </div>
        ) : null}
        {cashTendered != null ? (
          <div>
            <span>Change</span>
            <span>{formatPeso(changeAmount)}</span>
          </div>
        ) : null}
      </div>

      <p className="receipt-muted" style={{ marginTop: '14px', textAlign: 'center' }}>
        Thank you!
      </p>

      <div className="receipt-actions">
        <button type="button" onClick={() => window.print()}>
          Print
        </button>
      </div>
    </div>
  );
}