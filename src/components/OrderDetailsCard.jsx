import { getMenuImagePath } from '../utils/menu.js';
import { formatPeso } from '../utils/format.js';

// Order Details card — shown when an order row's View button is clicked.
export default function OrderDetailsCard({ order, details }) {
  if (!order) {
    return (
      <div id="orderDetailsCard" className="order-details-card mt-3">
        <h6 className="mb-2">Order Details</h6>
        <p className="text-muted text-sm m-0">
          Click <strong>View</strong> on an order row to see full details here.
        </p>
      </div>
    );
  }

  return (
    <div id="orderDetailsCard" className="order-details-card mt-3">
      <h6 className="mb-2">Order #{order.id} Details</h6>
      <div className="text-sm">
        <strong>Date/Time:</strong> {order.created_at}
      </div>
      <div className="text-sm">
        <strong>Customer:</strong> {order.customer_name}
      </div>
      <div className="text-sm">
        <strong>Order Type:</strong> {details.orderType}
      </div>
      <div className="text-sm">
        <strong>Cashier:</strong> {order.cashier_name || 'N/A'}
      </div>
      <div className="text-sm">
        <strong>Total Qty:</strong> {details.totalQty}
      </div>
      <div className="text-sm">
        <strong>Sub Total:</strong> {formatPeso(details.subTotal)}
      </div>
      {details.discountAmount > 0 ? (
        <div className="text-sm">
          <strong>
            Discount{details.discountLabel ? ` (${details.discountLabel})` : ''}:
          </strong>{' '}
          −{formatPeso(details.discountAmount)}
        </div>
      ) : null}
      <div className="text-sm">
        <strong>Tax:</strong> {formatPeso(details.taxTotal)}
      </div>
      <div className="text-sm">
        <strong>Grand Total:</strong> {formatPeso(details.grandTotal)}
      </div>
      <div className="text-sm">
        <strong>Payment:</strong> {order.payment_method}
      </div>
      {details.cashTendered != null ? (
        <div className="text-sm">
          <strong>Cash Tendered:</strong> {formatPeso(details.cashTendered)}
        </div>
      ) : null}
      {details.cashTendered != null ? (
        <div className="text-sm">
          <strong>Change:</strong> {formatPeso(details.changeAmount)}
        </div>
      ) : null}
      <div className="text-sm mb-2">
        <strong>Status:</strong> {order.order_status}
      </div>

      <div className="text-sm font-semibold mb-2">Items</div>
      {order.items && order.items.length > 0 ? (
        order.items.map((rowItem, i) => (
          <div
            key={i}
            className="order-item-preview flex items-center justify-between mb-1"
          >
            <div className="flex items-center gap-2">
              <img
                src={getMenuImagePath(rowItem.name)}
                alt={rowItem.name}
                className="order-item-thumb"
              />
              <div className="text-sm">{rowItem.name}</div>
            </div>
            <div className="text-sm text-muted">
              x{rowItem.quantity} | {formatPeso(rowItem.subtotal)}
            </div>
          </div>
        ))
      ) : (
        <p className="text-muted text-sm m-0">No order item details available.</p>
      )}
    </div>
  );
}