// Bundled customer directory — seeds the editable customer store on first
// run, matching the rows the business seeder writes to Supabase
// (scripts/seed-business.mjs). The store is the offline-first cache; the
// sync queue keeps the shared customers table current.
//
// [name, visits, totalSpent, tier] maps to complete rows below.
const SEED_ROWS = [
  ['Walk-in Customer', 1, 704.0, 'Bronze'],
  ['Maria Santos', 1, 2266.0, 'Bronze'],
  ['John Reyes', 1, 1485.0, 'Bronze'],
  ['Ana Cruz', 1, 2255.0, 'Bronze'],
  ['Emma Cruz', 1, 0.0, 'Bronze'],
  ['Paolo Garcia', 1, 913.0, 'Bronze'],
  ['Liza Mendoza', 1, 1320.0, 'Bronze'],
  ['Carl Dizon', 1, 1397.0, 'Bronze'],
  ['Diego Lopez', 1, 0.0, 'Bronze'],
  ['Nina Bautista', 1, 902.0, 'Bronze'],
  ['Marco Villanueva', 1, 1694.0, 'Bronze'],
  ['Sofia Ramos', 1, 1562.0, 'Bronze'],
  ['Adrian Santos', 1, 1232.0, 'Bronze'],
  ['Kayla Torres', 1, 792.0, 'Bronze'],
  ['Ramon Aguilar', 1, 1892.0, 'Bronze'],
];

export const CUSTOMER_TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum'];

export const CUSTOMERS = SEED_ROWS.map(([name, visits, totalSpent, tier], i) => ({
  id: i + 1,
  name,
  phone: '',
  email: '',
  visits,
  total_spent: totalSpent,
  tier,
}));