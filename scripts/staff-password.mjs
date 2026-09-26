// Staff passwords for the local maintenance and test scripts.
//
// These used to be hardcoded in each script, which published a working
// manager credential in the repository — anyone who cloned it could sign in.
// Scripts now read the password from the environment instead.
//
// Put the real values in your local .env (gitignored, never committed):
//
//   POS_CASHIER_PASSWORD=...
//   POS_MANAGER_PASSWORD=...
//
// Only the scripts that sign in to Supabase as a staff member need these.
// The browser app never reads them — it goes through Supabase Auth directly.

const KEYS = {
  cashier: 'POS_CASHIER_PASSWORD',
  manager: 'POS_MANAGER_PASSWORD',
};

export function staffPassword(role) {
  const key = KEYS[role];
  if (!key) {
    console.error(`staffPassword: unknown role "${role}" (expected cashier or manager).`);
    process.exit(1);
  }
  const value = process.env[key];
  if (!value) {
    console.error(
      `Missing ${key}.\n` +
        'Add it to your local .env (gitignored, never committed), e.g.\n' +
        `  ${key}=your-staff-password`
    );
    process.exit(1);
  }
  return value;
}
