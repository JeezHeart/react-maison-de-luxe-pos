import { useUIStore } from '../stores/uiStore.js';

// Global toast notification (bottom-right corner). Supports an optional
// inline action button (e.g. "Undo" a deletion).
export default function Toast() {
  const toast = useUIStore((s) => s.toast);
  const hideToast = useUIStore((s) => s.hideToast);

  if (!toast) {
    return null;
  }

  const handleAction = () => {
    if (toast.action && typeof toast.action.onClick === 'function') {
      toast.action.onClick();
    }
    hideToast();
  };

  return (
    <div key={toast.key} className="toast-notice" role="status">
      <span className="toast-message">{toast.message}</span>
      {toast.action ? (
        <button type="button" className="toast-action-btn" onClick={handleAction}>
          {toast.action.label || 'Undo'}
        </button>
      ) : null}
    </div>
  );
}