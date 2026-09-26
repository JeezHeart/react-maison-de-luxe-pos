// Static housekeeping notes. No props beyond the wrapper class, so it is a
// plain presentational component.
export default function QuickRemindersCard({ className = '' }) {
  return (
    <div className={`settings-box ${className}`.trim()}>
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
  );
}
