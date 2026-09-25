import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Download, KeyRound, X, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useOrderStore } from '../stores/orderStore.js';
import { useAuthStore } from '../stores/authStore.js';
import { useUIStore } from '../stores/uiStore.js';
import OrderDetailsCard from '../components/OrderDetailsCard.jsx';
import { exportOrdersCsv } from '../utils/csv.js';
import { formatPeso } from '../utils/format.js';

function statusBadgeClass(status) {
  const lower = String(status || '').toLowerCase();
  if (lower === 'completed') return 'status-completed';
  if (lower === 'pending') return 'status-pending';
  if (lower === 'cancelled') return 'status-cancelled';
  return 'status-default';
}

// Kanban board columns — the order status pipeline in flow order.
const BOARD_COLUMNS = [
  { status: 'Pending', icon: Clock },
  { status: 'Completed', icon: CheckCircle2 },
  { status: 'Cancelled', icon: XCircle },
];

// Orders section — order history table with View / Receipt / Delete,
// export CSV and the sliding order details card. Deleting runs directly
// for managers (or while manager authorization is still valid), otherwise
// a cashier must enter the manager PIN to approve the deletion.
export default function OrdersSection() {
  const orders = useOrderStore((s) => s.orders);
  const deleteOrder = useOrderStore((s) => s.deleteOrder);
  const restoreOrder = useOrderStore((s) => s.restoreOrder);
  const updateOrderStatus = useOrderStore((s) => s.updateOrderStatus);
  const getOrderDetails = useOrderStore((s) => s.getOrderDetails);

  const currentUser = useAuthStore((s) => s.currentUser);
  const managerAuthorizedUntil = useAuthStore((s) => s.managerAuthorizedUntil);
  const authorizeManager = useAuthStore((s) => s.authorizeManager);
  const showToast = useUIStore((s) => s.showToast);

  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pinShake, setPinShake] = useState(false);
  const [view, setView] = useState('table'); // 'table' | 'board'
  const [dragOverStatus, setDragOverStatus] = useState(null);

  const managerAuthorized = Date.now() < managerAuthorizedUntil;

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) || null,
    [orders, selectedOrderId]
  );
  const selectedDetails = selectedOrder ? getOrderDetails(selectedOrder) : null;

  const handleView = (order) => {
    setSelectedOrderId(order.id);
  };

  const confirmDelete = (order) => {
    deleteOrder(order.id);
    if (selectedOrderId === order.id) {
      setSelectedOrderId(null);
    }
    // Give a short window to undo the deletion before it sticks.
    showToast(`Order #${order.id} deleted.`, 4000, {
      label: 'Undo',
      onClick: () => restoreOrder(order),
    });
  };

  const handleDelete = (order) => {
    if (currentUser?.role === 'manager' || managerAuthorized) {
      if (window.confirm(`Delete Order #${order.id}? This cannot be undone.`)) {
        confirmDelete(order);
      }
      return;
    }
    // Cashier: ask for a manager PIN to approve the deletion.
    setDeleteTarget(order);
    setPinInput('');
    setPinError(false);
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    const ok = authorizeManager(pinInput);
    if (ok && deleteTarget) {
      confirmDelete(deleteTarget);
      setDeleteTarget(null);
      setPinInput('');
    } else {
      setPinError(true);
      setPinShake(true);
      setTimeout(() => setPinShake(false), 650);
    }
  };

  const handleDrop = (e, status) => {
    e.preventDefault();
    setDragOverStatus(null);
    const id = Number(e.dataTransfer.getData('text/plain'));
    const order = orders.find((o) => o.id === id);
    if (order && String(order.order_status) !== status) {
      updateOrderStatus(id, status);
      showToast(`Order #${id} moved to ${status}.`);
    }
  };

  return (
    <div id="ordersSection" className="main-section active-section">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="section-title m-0 flex items-center gap-1">
            <ShoppingBag size={26} aria-hidden="true" /> Orders
          </h4>
          <small className="text-muted">Track every customer transaction quickly.</small>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={`sales-range-btn ${view === 'table' ? 'active-range' : ''}`}
              onClick={() => setView('table')}
            >
              Table
            </button>
            <button
              type="button"
              className={`sales-range-btn ${view === 'board' ? 'active-range' : ''}`}
              onClick={() => setView('board')}
            >
              Board
            </button>
          </div>
          <button
            type="button"
            className="btn-outline-secondary-pos btn-sm-pos"
            onClick={() => exportOrdersCsv(orders)}
          >
            <Download size={14} aria-hidden="true" />
            Export CSV
          </button>
          <span className="text-muted text-sm">{orders.length} records</span>
        </div>
      </div>

      {view === 'table' ? (
        <div className="overflow-x-auto">
        <table className="table-pos orders-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Date/Time</th>
              <th>Customer</th>
              <th>Type</th>
              <th>Items</th>
              <th>Qty</th>
              <th>Sub Total</th>
              <th>Discount</th>
              <th>Tax</th>
              <th>Grand Total</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Cashier</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length > 0 ? (
              orders.map((order) => {
                const details = getOrderDetails(order);
                return (
                  <tr
                    key={order.id}
                    className={selectedOrderId === order.id ? 'order-row-highlight' : ''}
                  >
                    <td>#{order.id}</td>
                    <td>{order.created_at}</td>
                    <td>{order.customer_name}</td>
                    <td>{order.order_type || 'Dine-in'}</td>
                    <td className="items-col">{details.itemsSummary || 'No items'}</td>
                    <td>{details.totalQty}</td>
                    <td>{formatPeso(details.subTotal)}</td>
                    <td>{details.discountAmount > 0 ? formatPeso(details.discountAmount) : '—'}</td>
                    <td>{formatPeso(details.taxTotal)}</td>
                    <td>{formatPeso(details.grandTotal)}</td>
                    <td>{order.payment_method}</td>
                    <td>
                      <span className={`status-badge ${statusBadgeClass(order.order_status)}`}>
                        {order.order_status}
                      </span>
                    </td>
                    <td>{order.cashier_name || 'N/A'}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="btn-outline-primary-pos btn-sm-pos view-order-btn"
                          onClick={() => handleView(order)}
                        >
                          View
                        </button>
                        <Link
                          className="btn-outline-secondary-pos btn-sm-pos"
                          target="_blank"
                          to={`/receipt/${order.id}`}
                        >
                          Receipt
                        </Link>
                        <button
                          type="button"
                          className="btn-outline-danger-pos btn-sm-pos"
                          onClick={() => handleDelete(order)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={14} className="text-center text-muted py-3">
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      ) : (
        <div>
          <p className="text-muted text-sm mb-2">
            Drag a card between columns to change its status. Click a card to view details.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {BOARD_COLUMNS.map(({ status, icon: Icon }) => {
              const columnOrders = orders.filter(
                (o) => String(o.order_status) === status
              );
              return (
                <div
                  key={status}
                  className={`board-column ${dragOverStatus === status ? 'drop-target' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverStatus(status);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) {
                      setDragOverStatus(null);
                    }
                  }}
                  onDrop={(e) => handleDrop(e, status)}
                >
                  <div className="board-column-header">
                    <Icon size={14} aria-hidden="true" />
                    <span>{status}</span>
                    <span className="board-column-count">{columnOrders.length}</span>
                  </div>
                  <div className="board-column-list">
                    {columnOrders.length > 0 ? (
                      columnOrders.map((order) => {
                        const details = getOrderDetails(order);
                        return (
                          <div
                            key={order.id}
                            className={`board-order-card ${
                              selectedOrderId === order.id ? 'board-card-selected' : ''
                            }`}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', String(order.id));
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onClick={() => handleView(order)}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="board-order-id">#{order.id}</span>
                              <span className={`status-badge ${statusBadgeClass(order.order_status)}`}>
                                {order.order_status}
                              </span>
                            </div>
                            <div className="board-order-customer">{order.customer_name}</div>
                            <div className="board-order-meta">
                              {order.created_at} · {details.totalQty} item
                              {details.totalQty === 1 ? '' : 's'} · {details.itemsSummary}
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <div className="text-muted text-xs">
                                {order.payment_method} · {order.order_type || 'Dine-in'}
                              </div>
                              <div className="board-order-total">{formatPeso(details.grandTotal)}</div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-muted text-sm m-0 board-empty">
                        No {status.toLowerCase()} orders.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <OrderDetailsCard order={selectedOrder} details={selectedDetails} />

      {/* Manager PIN gate — shown when a cashier tries to delete an order. */}
      {deleteTarget ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Manager PIN required">
          <div className={`product-modal-content pin-modal p-3 md:p-4 ${pinShake ? 'shake-x' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <h6 className="m-0 flex items-center gap-2">
                <KeyRound size={18} aria-hidden="true" /> Manager PIN Required
              </h6>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setDeleteTarget(null)}
                aria-label="Cancel"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p className="text-sm text-muted mb-2">
              Deleting Order #{deleteTarget.id} requires the manager PIN.
            </p>
            <form onSubmit={handlePinSubmit}>
              <input
                type="password"
                inputMode="numeric"
                className="field-control mb-1"
                autoFocus
                placeholder="Enter manager PIN"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
              />
              {pinError ? (
                <p className="form-error text-sm mb-2">Incorrect PIN. Try again.</p>
              ) : null}
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  className="btn-outline-secondary-pos btn-sm-pos"
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-outline-danger-pos btn-sm-pos">
                  Delete Order
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}