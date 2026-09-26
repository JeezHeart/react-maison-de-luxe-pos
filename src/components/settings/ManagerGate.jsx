// Renders its children only for managers, and an explanation for everyone
// else. The two manager-only panels on the settings screen (menu management
// and the customer directory) had this same ternary duplicated; keeping one
// copy means the wording cannot drift apart.
export default function ManagerGate({ isManager, title, subject, children }) {
  if (isManager) {
    return children;
  }
  return (
    <>
      <h6 className="mb-2">{title}</h6>
      <p className="text-muted text-sm m-0">
        Only managers can add, edit, or delete {subject}. Ask a manager to sign in to make changes.
      </p>
    </>
  );
}
