# Maison de Luxe POS

A modern point-of-sale web application for a luxury restaurant. Built with
**React** and **Tailwind CSS**, it provides a responsive cashier dashboard with
menu ordering, an invoice cart, order history, sales reports, and settings.

**Offline-first by design:** the app reads/writes `localStorage` instantly and
keeps a sync queue, with **Supabase** as the shared source of truth. When no
Supabase credentials are configured (or the network is down), it still runs
fully on `localStorage` — it just doesn't sync.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| UI | React 18 + JavaScript (JSX) |
| Styling | Tailwind CSS 3 + custom luxury theme (`src/index.css`) |
| Build | Vite 5 |
| Routing | React Router 6 (BrowserRouter, SPA) |
| State | Zustand (cart, orders, UI, settings, auth) |
| Backend | Supabase (Postgres + Auth + REST), `@supabase/supabase-js` |
| Sync | Offline-first queue: local writes → flush → pull/merge (`src/lib/sync*.js`) |
| Icons | Lucide React |
| Deployment | Vercel (Git integration on `main`) + optional Docker/Nginx |

---

## Features

| Module | Description |
|--------|-------------|
| **Landing page** | Marketing-style home before entering the POS |
| **Dashboard (Menu)** | Browse menu by category, search, product detail modal with add-ons, live invoice cart |
| **Orders** | Order history, order details, print receipt, delete orders, CSV export |
| **Reports** | Sales stats, top-selling items, payment breakdown with date filters |
| **Settings** | Restaurant profile + system snapshot |
| **Menu manager** | Manager-only add/edit/delete of menu items and categories (synced) |
| **Customer directory** | Manager-only add/edit/delete/search of customers; checkout autocompletes names (synced) |
| **Cloud sync** | Placed orders, menu, customers, and settings sync to Supabase when online; queue retries on reconnect |
| **Staff accounts** | Login with `cashier / 123456` or `manager / admin123` (Supabase Auth, username→email mapping) |

---

## Project Structure

```
├── src/
│   ├── main.jsx            # React entry (BrowserRouter)
│   ├── App.jsx             # Routes: / , /pos/* , /receipt/:id
│   ├── lib/
│   │   ├── supabase.js     # Supabase client (null when unconfigured — local-only mode)
│   │   ├── sync.js         # Sync queue (luxury_pos_sync_queue) + flush/pull/merge
│   │   └── syncController.js # Scheduling: login/reconnect/30s + status toasts
│   ├── stores/             # cartStore · orderStore · menuStore · customerStore · settingsStore · authStore · uiStore
│   ├── components/         # Sidebar · InvoicePanel · SyncStatus · ProductDetailModal · ...
│   ├── pages/              # LandingPage · PosLayout · Login · Dashboard/Orders/Reports/Settings · ReceiptPage
│   └── data/               # menu.js (48 items) · customers.js (15) · addons.js · imageFiles.js
├── supabase/migrations/    # 0001_initial_schema.sql (schema + RLS + grants)
├── scripts/                # seeders + integration tests (see below)
├── .env.example            # Committed template for Supabase credentials
└── .env                    # Local credentials — gitignored, never committed
```

---

## Routes

| Route | Content |
|-------|---------|
| `/` | Landing page (marketing home, "Open POS" starts the app) |
| `/login` | Staff sign-in (Supabase Auth with local fallback) |
| `/pos` | Dashboard — menu grid, search, categories, product modal + add-ons, invoice panel |
| `/pos/orders` | Orders — history, details, delete, print receipt, CSV export |
| `/pos/reports` | Reports — date filters, stats, top items, payment breakdown |
| `/pos/settings` | Settings — restaurant profile + system snapshot |
| `/receipt/:id` | Printable receipt (opens in a new tab) |

Any other path redirects to `/`.

---

## Setup

### 1. Install & run locally

```bash
npm install
npm run dev      # http://localhost:5173
```

Without any credentials the app runs fine as a **local-only** POS.

### 2. Optional: enable cloud sync (Supabase)

```bash
cp .env.example .env
```

Fill in (from Supabase → Settings → API Keys):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

- `VITE_SUPABASE_PUBLISHABLE_KEY` — **public**, safe in the browser bundle.
- `VITE_SUPABASE_ANON_KEY` — legacy fallback, still accepted by `supabase.js`.
- ⛔ Never put a **Secret key** (`sb_secret_...`) or the legacy `service_role`
  JWT in `.env`/Vercel/browser code — they bypass Row Level Security.

### 3. Database

Apply `supabase/migrations/0001_initial_schema.sql` once (dashboard SQL editor,
or `supabase db push`). The migration creates the tables, RLS policies, and
grants. ⚠️ Re-running the SQL file is **not** idempotent (`create policy`
statements will fail) — only the seed scripts below are safe to re-run.

### 4. Seed demo data (optional, once)

```powershell
# Use the NEW secret key (sb_secret_...) as SUPABASE_SECRET_KEY.
# (Legacy SUPABASE_SERVICE_ROLE_KEY still accepted for backwards compat.)
$env:SUPABASE_URL="https://<project-ref>.supabase.co"
$env:SUPABASE_SECRET_KEY="sb_secret_..."
npm run seed:business   # customers, settings, sample orders + items
npm run seed:auth       # demo staff accounts (cashier@ / manager@maison.de.luxe)
```

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server (http://localhost:5173) |
| `npm run build` | Production bundle into `dist/` |
| `npm run preview` | Serve the production bundle locally |
| `npm run seed:business` | Idempotently seed customers/settings/orders (needs `SUPABASE_SECRET_KEY`) |
| `npm run seed:auth` | Create demo staff auth accounts + profiles (needs `SUPABASE_SECRET_KEY`) |
| `npm run test:sync` | Full offline-first sync integration test against the live DB (40 checks) |
| `npm run test:smoke` | Smoke test of the exact API path the browser uses (reads/writes) |

`test:sync` and `test:smoke` load `.env` automatically and clean up after
themselves (restore menu stock, delete probe rows).

---

## Deployment (Vercel)

Production is deployed from the GitHub repo (`JeezHeart/react-maison-de-luxe-pos`,
branch `main`) via the Vercel Git integration — every push auto-deploys.

Environment Variables in Vercel (scope: **Production**):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Only public values belong here — Vite inlines `VITE_*` variables into the
public bundle, so a secret key there would be exposed to the world.

---

## Security Notes

- **RLS protects the data.** Anonymous/POST requests get 401/403; only
  `authenticated` staff sessions read/write business tables through Supabase.
- **The new key API** (`sb_publishable_` / `sb_secret_`) replaces the legacy
  `anon` / `service_role` JWTs, which Supabase is retiring by end of 2026.
  Legacy key support is left disabled on the project.
- **If a secret key leaks:** create a new Secret key in Supabase → Settings →
  API Keys, point every admin tool at it, then delete/disable the old key.
- `.env` is gitignored — credentials are never committed.

---

## Data & Persistence

- **localStorage is the cache**, Supabase is the source of truth. Order rows
  appear instantly, then sync via the `luxury_pos_sync_queue`.
- **Menu** — 48 items across 8 categories.
- **Orders** — seeded sample history on first run (`luxury_pos_orders`).
  Tax is backed out of the stored grand total (`subtotal = total ÷ 1.10`, 10% tax).
- **Settings** — restaurant name/contact/address persist locally
  (`pos_restaurant_name`, `pos_restaurant_contact`, `pos_restaurant_address`).
- **Images** — menu-name slugs map to real filenames in `public/assets/images/`
  (including some double-extension files like `.jpg.jpg`).
- **Nutrition** — computed from price and stock:
  `calories = price × 8.5`, `carbs = (stock % 20) + 15`,
  `protein = (stock % 18) + 12`, `fat = (stock % 14) + 8`.
- **CSV export** — generated fully client-side with the same columns shown in
  the Orders table.
- **Never sells what's not in stock** — the invoice cart caps quantity at the
  item's remaining stock (across add-on variants), and the POS menu upsert
  clamps to `stock >= 0`.
- **Deletes are undoable** — deleting an order, menu item, or customer shows a
  4-second **Undo** toast that re-inserts the record locally and re-syncs it
  to the cloud. Deleting an order also returns the sold stock to inventory.

---

## Optional: Docker + Nginx

```bash
docker compose up --build
# open http://localhost:8080
```

The multi-stage `Dockerfile` builds the Vite app with Node 20 and serves the
static bundle with Nginx. `nginx.conf` sets up the SPA fallback and caches
hashed `/assets/` files for a year.