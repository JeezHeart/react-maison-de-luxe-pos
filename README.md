# Maison de Luxe POS

**A modern, offline-first point-of-sale web application for a luxury restaurant.**

Maison de Luxe POS is a cashier-and-manager system that handles menu ordering,
invoices, order tracking, sales reports, inventory (menu stock), customers, and
restaurant settings — and it keeps working even with **no internet connection**.

> **Live demo:** <https://maison-de-luxe-pos.vercel.app>
>
> Sign in with the staff accounts created for this deployment (`cashier` or
> `manager` as the username). Their passwords are **not** in this repository —
> they live in Supabase Auth, and only the project owner can set them.

| Role | Username | What you land on |
|------|----------|------------------|
| **Cashier** | `cashier` | The POS register (`/pos`) — menu, checkout, orders, reports, settings |
| **Manager** | `manager` | The admin dashboard (`/admin`) — overview, orders, reports, settings **plus** menu & customer management |

> **No Supabase configured?** The app falls back to pure-local mode with two
> bundled demo accounts, so you can click through it with no setup. Those
> accounts are local-only — they do not work on a deployment that has Supabase
> configured, and they are not listed here because the source is public. See
> `ACCOUNTS` in `src/stores/authStore.js`.

---

## Table of Contents

1. [How the App Works (The Core Idea)](#how-the-app-works-the-core-idea)
2. [Who Uses It, and What Each Role Can Do](#roles-and-permissions)
3. [Feature & Function Guide](#feature--function-guide)
4. [Cross-Cutting Systems](#cross-cutting-systems)
5. [Tech Stack](#tech-stack)
6. [Architecture & Data Flow](#architecture--data-flow)
7. [Database Schema](#database-schema)
8. [Project Structure](#project-structure)
9. [Setup (Run Locally)](#setup-run-locally)
10. [Available Scripts](#available-scripts)
11. [Testing & Quality Assurance](#testing--quality-assurance)
12. [Deployment (Vercel)](#deployment-vercel)
13. [Security & Keys](#security--keys)
14. [Data & Persistence Details](#data--persistence-details)
15. [Known Limitations (Honest Notes)](#known-limitations-honest-notes)

---

## How the App Works (The Core Idea)

- **It is a web app** — no installation needed; it runs in any browser, on
  desktop or phone.
- **It is offline-first** — every action (placing an order, editing the menu,
  adding a customer) is written instantly to the browser's `localStorage`. If
  the internet is available, the same action is also queued and uploaded to a
  **Supabase** cloud database (the "source of truth"). If the internet drops,
  the app keeps working and uploads everything the moment it reconnects.
- **It is a Progressive Web App (PWA)** — after the first visit, it can be
  "installed" like a native app and opens instantly even with zero network.
- **It is multi-register** — several devices can sell at the same time; changes
  from one device appear on the others within about **1.2 seconds**.

```
  Cashier's browser                      Manager's browser
  ┌───────────────────┐                  ┌───────────────────┐
  │  localStorage     │   upload queue   │  localStorage     │
  │  cache + queue    │ ───────────────▶ │  cache + queue    │
  └─────────┬─────────┘                  └─────────┬─────────┘
            │  ◀──────  pull everything  ───────▶  │
            ▼                                      ▼
        ┌───────────────────────────────────────────────┐
        │        Supabase cloud database (Postgres)      │
        │        — the shared source of truth —          │
        └───────────────────────────────────────────────┘
```

---

## Roles and Permissions

The app has **two separate workspaces**: a **cashier register** (`/pos`) for
taking orders, and a **manager dashboard** (`/admin`) for overseeing and
configuring the business. Each role is routed automatically after sign-in, and
attempting to open the other workspace bounces you back to your own.

| Capability | Cashier | Manager |
|---|---|---|
| Browse menu, search, add to cart | ✅ | — (admin shell has no checkout) |
| Place orders (invoice) | ✅ | — |
| View / print / export orders | ✅ | ✅ |
| Change order status (drag & drop kanban) | ✅ | ✅ |
| Delete an order | ✅ *(requires manager PIN)* | ✅ *(direct)* |
| View reports & sales analytics | ✅ | ✅ |
| Edit restaurant profile (Settings) | ✅ | ✅ |
| **Manage menu items & categories** | ❌ locked | ✅ |
| **Manage customer directory** | ❌ locked | ✅ |
| Manager overview dashboard | ❌ | ✅ |

> **Manager PIN convenience:** when a *cashier* deletes an order, the app asks
> for the manager's PIN once. After a correct entry, the cashier is
> "authorized" for **5 minutes**, so several deletions can happen without
> re-entering the PIN.

---

## CRUD Operations Matrix

Every business entity supports full Create/Read/Update/Delete with offline-first sync:

| Entity | Create | Read | Update | Delete | Notes |
|--------|--------|------|--------|--------|-------|
| **Menu Items** | ✅ Manager adds (name, category, description, price, stock) | ✅ All roles (dashboard, search, autocomplete) | ✅ Manager edits any field; auto-syncs to cloud | ✅ Manager deletes; 4s Undo toast; blocked if category not empty | Stock auto-deducted on order; restored on delete/undo |
| **Categories** | ✅ Manager adds | ✅ Derived from items | ✅ Manager renames (cascades to items) | ✅ Manager deletes; blocked if items still in category | |
| **Orders** | ✅ Cashier places (cart → invoice) | ✅ All roles (table, kanban, receipt, CSV) | ✅ Status drag-drop (Pending/Completed/Cancelled) | ✅ Cashier needs manager PIN; Manager direct; auto-restores stock | Collision-safe 16-digit IDs; 4s Undo toast |
| **Order Items** | ✅ Auto-created with order | ✅ In order detail / receipt | — (immutable after creation) | ✅ Cascade-deleted with parent order | |
| **Customers** | ✅ Manager adds (name, phone, email, tier, visits, spent) | ✅ Autocomplete at checkout; directory in Settings | ✅ Manager edits any field | ✅ Manager deletes; 4s Undo toast | Duplicate names rejected; tier: Bronze/Silver/Gold/Platinum |
| **Settings** (profile) | — (seeded) | ✅ All roles | ✅ Cashier & Manager save name/contact/address | — | Synced to cloud key/value table |
| **Staff (Auth)** | ✅ Via `npm run seed:auth` (Supabase Auth + profiles) | ✅ Login reads profile | — | — | Roles: cashier / manager |

---

## Feature & Function Guide

Everything below is grouped by the screen you see in the app. Each entry states
**what it does** and **what it is used for**.

### 1. Landing Page (`/`)

- **What it does:** a marketing-style home page with the restaurant branding and
  an **Open POS** button that leads to sign-in.
- **Used for:** a friendly entry point before staff enter the system.

### 2. Sign-In (`/login`)

- **What it does:** username + password authentication (Supabase Auth when
  configured, with a built-in local fallback so the app never blocks logins).
  The two usernames (`cashier`, `manager`) map to the Supabase Auth accounts;
  the passwords live only in Supabase and in your local `.env`, never in this
  repository. The demo-credential hint on this screen appears **only** in
  pure-local mode — with Supabase configured it is hidden, so a deployment
  never prints a working password to a visitor.
- **What it's used for:** protecting the POS so only staff can place orders or
  change business data. It remembers your session, so refreshing the page keeps
  you signed in.

### 3. Register / Menu Dashboard (`/pos`) — *the cashier's main screen*

| Feature | What it does | Used for |
|---|---|---|
| **Search** | Instant, type-as-you-go search by item name | Finding an item quickly (e.g. typing "steak") |
| **Category filter** | 8 category buttons — **Breakfast · Lunch · Dinner · Soup · Desserts · Side Dish · Appetizer · Beverages** — with a collapsible bar | Narrowing the menu wall to one section |
| **Food cards** | Photo, name, description, price, and a **stock badge** (green = in stock, amber = "Low · 5 left", red = "Out of Stock") | Letting the cashier see price and availability at a glance |
| **Quick "+ Add"** | One-tap add to the invoice cart (disabled when sold out) | Fast checkout for simple orders |
| **Product detail modal** | Tapping a card opens a full view: description, **nutrition** (calories / carbs / protein / fat), ingredients, and **add-ons** with their prices; live item total; **Add To Invoice** button | Customizing an item (e.g. "Extra Parmesan", "Spicy Sauce") before adding it |
| **Invoice panel** | The right-hand cart: every line shows name, unit price, quantity **+ / −** buttons, and line total | Building the current order |
| **Stock-safe quantity** | The cart refuses to add more than the remaining stock (even across add-on variants) and shows a toast explaining why | Guaranteeing the POS **never sells what isn't in stock** |
| **Customer autocomplete** | The Customer Name field offers suggestions from the customer directory as you type | Speeding up checkout for return customers |
| **Order type** | Select **Dine-in / Takeout / Delivery** | Recording how the customer is being served |
| **Discount** | **No Discount**, **Senior & PWD (20%)**, **Fixed Amount (₱)**, or **Percentage (%)**; math is clamped so the total can never go negative | Honoring promos and mandated discounts |
| **Payment method** | **Credit Card · Paylater · Cash Payout · GCash · Maya** (tab buttons) | Recording how the bill was paid |
| **Cash tendered & change** | When paying cash, enter the amount given; the invoice live-computes **Change** (and shows a "Short" warning if it's too little); the order is blocked if tendered < total | Correct cash handling and float accuracy |
| **Tax (10%)** | Subtotal + 10% VAT, shown as its own line | Legal/PH VAT-compliant receipts |
| **Place An Order** | Validates, writes the order locally + syncs, and **auto-deducts stock** for every item sold | Finalizing a sale |
| **Recent Orders** | The last 5 orders (id, customer, payment, time) under the invoice | Quick confirmation that the sale went through |

### 4. Orders (`/pos/orders` and `/admin/orders`)

| Feature | What it does | Used for |
|---|---|---|
| **Table view** | Full order history: ID, date/time, customer, type, items, quantity, subtotal, discount, tax, grand total, payment, status, cashier, actions | When you need the complete ledger record |
| **Kanban board view** | Three columns — **Pending / Completed / Cancelled** — with order cards; **drag a card** between columns to change its status | Visually managing the kitchen/service pipeline |
| **View (details card)** | Opens a sliding detail card with full order breakdown (sold items, prices, totals, cash/change, discount) | Inspecting a specific transaction |
| **Receipt** | Opens the printable receipt in a new tab (`/receipt/:id`) | Handing a customer their receipt or printing |
| **Export CSV** | Downloads the orders as a `.csv` file (same columns as the table), generated entirely in the browser. On the Orders page that is the full ledger; **on the manager overview it is only the range currently selected**, and the filename is tagged with it (e.g. `orders_export_2026-09-26_last14d.csv`) | Bookkeeping, Excel analysis, accountant hand-off — a file always says which period it covers |
| **Delete order** | Removes the order *and automatically restores the sold stock* to inventory; shows a 4-second **Undo** toast | Correcting a mistaken/fake sale without losing inventory |
| **Manager PIN gate** | Cashier deletes require the manager's PIN (valid 5 minutes) | Preventing a cashier from removing sale records on their own |

### 5. Reports (`/pos/reports` and `/admin/reports`)

| Feature | What it does | Used for |
|---|---|---|
| **Date range filter** | **All Time / Today / This Week / This Month** | Viewing sales for a specific period |
| **Sales trend chart** | Line/area chart of sales over time — hourly for Today, daily for Week/Month, monthly for All Time | Spotting busy hours and daily/weekly patterns |
| **Top 5 selling items** | Bar chart + table of item name, quantity sold, revenue | Knowing what to promote or re-stock |
| **Payment breakdown** | Donut chart + table: orders, total, and **% of sales** per payment method | Seeing how customers pay (helps float/cash management) |
| **KPI cards** | Total Orders, Menu Items, Total Sales, Avg Order Value | The headline numbers at a glance |
| **Insights** | **Cancelled (lost revenue)**, **Discounts given**, and **Top cashier** for the period | Answering "how much did discounts cost us?" and staff performance |

### 6. Manager Overview (`/admin`)

| Feature | What it does | Used for |
|---|---|---|
| **Sales range switcher** | 7 / 14 / 30-day trend | The last week, fortnight, or month of revenue |
| **Today's numbers** | Orders and sales today, live totals, average order value | Morning/evening business check |
| **Low-stock watchlist** | Items with stock ≤ 5, sorted most-critical first | Re-ordering ingredients before you run out |
| **Charts** | Top sellers + payment mix (same charts as Reports) | Quick strategic view without digging |
| **Recent orders** | The latest 5 transactions with a link into full order management | Seeing what just came in |

### 7. Settings (`/pos/settings` and `/admin/settings`)

| Feature | What it does | Used for |
|---|---|---|
| **Restaurant Profile** | Edit restaurant name, contact number, and address; **Save** / **Reset** | Branding shown throughout the system; synced to the cloud |
| **System Snapshot** | Live counts: **Total Users** (queried from the staff accounts table when online), Menu Items, Customers, Orders | A one-glance "health check" of the system |
| **Quick Reminders** | Maintenance notes (image storage, storage reset, image naming) | Operational guidance for staff |
| **Menu Management** *(manager only)* | Add / edit / delete menu items (name, category, description, price, stock); **New Item**, **Edit**, trash with **Undo** toast; search the item list | Keeping the menu and prices current without a developer |
| **Category management** *(manager only)* | Add a category, rename in place, or delete one — deletion is blocked while items still belong to it | Organizing the register's menu wall |
| **Restore Default Menu** | One-click reset back to the 48 seed items | Emergency rollback of menu mistakes |
| **Customer Directory** *(manager only)* | Add / edit / delete customers (name, phone, email, visits, total spent, **tier: Bronze / Silver / Gold / Platinum**); duplicate names rejected; search; **Undo** on delete; rows showed with loyalty stats | Building a customer database that **autocompletes names at checkout** |

### 8. Receipt (`/receipt/:id`)

- **What it does:** a clean, print-optimized receipt (merchant name, order id,
  line items, totals, payment, cash/change), opened from the Orders screen.
- **Used for:** printing or showing a customer's proof of purchase.

---

## Cross-Cutting Systems

These are system-wide behaviors, not tied to a single screen.

| System | What it does | Why it matters |
|---|---|---|
| **Offline-first sync** | Every write goes to `localStorage` instantly *and* to a sync queue; when online, the queue is flushed to Supabase and everything is pulled back down | The POS **never blocks on the network**; two laptops sharing one cloud stay consistent |
| **Near-instant multi-register sync** | Any queued change triggers a sync pass within ~1.2s (30s periodic tick as backstop) | Register B sees Register A's sale/stock/edit almost immediately |
| **Collision-safe order IDs** | New orders get a 16-digit numeric ID built from the current time + a per-device counter, strictly increasing on the device | Two registers can place orders at the exact same moment without ever losing one to a duplicate-ID error |
| **Stock integrity** | The cart caps quantity to remaining stock; every order auto-deducts stock; every deleted order returns its stock; Supabase clamps `stock >= 0` | The system "never sells what it doesn't have" and bad deletes can't drain inventory |
| **Undo on delete** | Deleting an order, menu item, or customer shows a 4-second **Undo** toast that re-inserts and re-syncs it | Accidental deletions are instantly reversible |
| **Sync status badge** | A small dot in the header shows **Syncing… / Synced / Offline**; hidden entirely in pure-local mode | Staff can see whether changes are reaching the cloud |
| **PWA / installable** | Manifest + service worker: the app can be installed to the home screen and opens with zero network after first visit | It behaves like a native register app on tablets/phones |
| **Toasts** | Small notifications for every action (added / saved / deleted / undo) | Instant visual confirmation of what just happened |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| UI | React 18 + JavaScript (JSX) |
| Styling | Tailwind CSS 3 + custom luxury theme (`src/index.css`) |
| Build | Vite 5 |
| Routing | React Router 6 (BrowserRouter, SPA) |
| State | Zustand (cart, orders, menu, customers, settings, auth, UI) |
| Backend | Supabase (Postgres + Auth + REST), `@supabase/supabase-js` |
| Sync | Offline-first queue: local writes → flush → pull/merge (`src/lib/sync*.js`) |
| Charts | Custom lightweight SVG chart components (`ReportCharts.jsx`) |
| Icons | Lucide React |
| PWA | `vite-plugin-pwa` (manifest + generated service worker) |
| Tests | Vitest (unit), Node integration scripts (live DB) |
| Deployment | Vercel (Git integration on `main`) + optional Docker/Nginx |

---

## Architecture & Data Flow

### Local-first reads and writes

1. **Reads** always come from `localStorage` (seeded on first run). This is why
   the app paints instantly and works offline.
2. **Writes** update `localStorage` immediately, then are appended to a sync
   queue (`luxury_pos_sync_queue`).
3. The **sync controller** (started after sign-in) runs a pass:
   - on login, when the browser goes online, every ~30 seconds, and ~1.2s after
     any queued change;
   - each pass: upload local-only rows → **flush the queue** (insert/update/
     delete on Supabase) → **pull everything back down** into `localStorage`.
4. Cloud wins on pull — but only after the queue is flushed, so nothing locally
   unique is ever overwritten.

### Key stores (Zustand)

| Store | Holds | Notable behavior |
|---|---|---|
| `cartStore` | Invoice cart lines | Stock-cap enforcement on add and qty `+` |
| `orderStore` | Orders + derived totals | Generates collision-safe IDs; place/delete/restore keep stock in sync |
| `menuStore` | Menu items + categories + stock | `LOW_STOCK_THRESHOLD = 5`; reduce/restore stock; rename cleanup |
| `customerStore` | Customer directory | Duplicate-name rejection; undo restore |
| `settingsStore` | Restaurant profile | Name/contact/address keys |
| `authStore` | Current user, session, manager PIN window | Online (Supabase Auth) + offline (bundled demo) login |
| `uiStore` | Toasts, product modal, add-ons, sync state | — |

---

## Database Schema

Applied by `supabase/migrations/0001_initial_schema.sql` (Postgres, with
**Row Level Security** enabled — only signed-in `authenticated` users can read
or write business data):

| Table | Purpose | Notable columns |
|---|---|---|
| `menu_items` | The live product catalog | `name` (unique), `category`, `price`, `stock` with `check (stock >= 0)` |
| `orders` | Every sale | `id` (bigint, app-generated 16-digit), `customer_name`, `order_type`, `sub_total`, `discount_amount`, `tax_amount`, `total_amount`, `payment_method` (check-constrained), `order_status` (check-constrained), `cashier_name`, `created_at` (timestamptz) |
| `order_items` | Line items per order | `order_id` (FK, cascade delete), `name`, `quantity`, `unit_price`, `subtotal` |
| `customers` | Loyalty directory | `name` (unique), `phone`, `email`, `visits`, `total_spent`, `tier` |
| `settings` | Key/value restaurant profile | `key` (unique: name / contact / address), `value` |
| `profiles` | Staff accounts for the UI | `id` (FK to auth.users), `role`, `name` |

---

## Project Structure

```
├── src/
│   ├── main.jsx            # React entry (BrowserRouter)
│   ├── App.jsx             # Routes + role gate; starts the sync controller
│   ├── lib/
│   │   ├── supabase.js     # Supabase client (null when unconfigured → local-only)
│   │   ├── sync.js         # Sync queue + enqueue + flush + dispatchers
│   │   └── syncController.js # Scheduling: login/reconnect/30s/queue-change
│   ├── stores/             # cartStore · orderStore · menuStore · customerStore
│   │                       # · settingsStore · authStore · uiStore
│   ├── components/         # Sidebar · InvoicePanel · ProductDetailModal ·
│   │                       # OrderDetailsCard · SyncStatus · Toast · ReportCharts
│   │   └── settings/       # the Settings screen's cards, one per panel:
│   │                       # RestaurantProfile · SystemSnapshot · QuickReminders ·
│   │                       # MenuManagement · CustomerDirectory · ManagerGate ·
│   │                       # MenuItemEditorModal · CustomerEditorModal
│   ├── pages/              # LandingPage · LoginPage · PosLayout · AdminLayout ·
│   │                       # DashboardSection · OrdersSection · ReportsSection ·
│   │                       # SettingsSection (layout only) · AdminPage · ReceiptPage
│   ├── utils/              # format (parseDate/Peso/round2) · csv (buildOrdersCsv/exports) ·
│   │                       # menu (images/nutrition) · dateRange (rangeBounds/filterByBounds) ·
│   │                       # menuItemValidation · customerValidation
│   └── data/               # menu.js (48 items) · customers.js (15) · addons.js · imageFiles.js
├── public/                 # index.html template, icons/, assets/images/
├── supabase/migrations/    # 0001_initial_schema.sql (schema + RLS + grants + check constraints)
├── scripts/                # seeders + live-DB integration tests
├── tests/                  # Vitest unit tests + setup shim
├── .env.example            # Committed template for Supabase credentials
└── .env                    # Local credentials — gitignored, never committed
```

---

## Setup (Run Locally)

### 1. Install & run

```bash
npm install
npm run dev      # http://localhost:5173
```

**No credentials needed** — without any Supabase config the app runs fully as a
local-only POS (Great for a first look or a demo booth).

### 2. Optional: enable cloud sync (Supabase)

```bash
cp .env.example .env
```

Then fill in (Supabase → Project Settings → API Keys):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

- `VITE_SUPABASE_PUBLISHABLE_KEY` — **public**, safe in the browser bundle.
- `VITE_SUPABASE_ANON_KEY` — legacy fallback, still accepted by `supabase.js`.
- `POS_CASHIER_PASSWORD` / `POS_MANAGER_PASSWORD` — staff passwords, needed
  **only** by the local scripts that sign in as a staff member (`test:smoke`,
  `test:sync`, `seed:auth`, `seed:business`, `restore:menu`,
  `repair:menu-seq`). Deliberately not `VITE_`-prefixed, so they can never be
  bundled into the browser. Keep them in `.env`, which is gitignored.
- ⛔ Never put a **Secret key** (`sb_secret_...`) or the legacy `service_role`
  JWT in `.env`/Vercel/browser code — they bypass Row Level Security.

### 3. Database

Apply `supabase/migrations/0001_initial_schema.sql` once (dashboard SQL editor,
or `supabase db push`). ⚠️ Re-running the SQL file is **not** idempotent
(`create policy` statements will fail) — only the seed scripts below are safe
to re-run.

### 4. Seed demo data (optional, once)

```powershell
# Use the NEW secret key (sb_secret_...) as SUPABASE_SECRET_KEY.
# (Legacy SUPABASE_SERVICE_ROLE_KEY still accepted for backwards compat.)
$env:SUPABASE_URL="https://<project-ref>.supabase.co"
$env:SUPABASE_SECRET_KEY="sb_secret_..."
# Staff passwords — NOT the secret key. Whatever you set in Supabase Auth
# for these two accounts, so the seeder can create them with it.
$env:POS_CASHIER_PASSWORD="choose-a-unique-password"
$env:POS_MANAGER_PASSWORD="choose-a-different-unique-password"
npm run seed:business   # customers, settings, sample orders + items
npm run seed:auth       # staff accounts (cashier@ / manager@maison.de.luxe)
```

> Re-running `seed:auth` will not overwrite an existing account's password —
> Supabase rejects creating a user whose email already exists. To change a
> password after the fact, use the Supabase dashboard
> (Authentication → Users), then update the matching `POS_*_PASSWORD` in your
> local `.env` so the scripts keep working.

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server (http://localhost:5173) |
| `npm run build` | Production bundle into `dist/` (+ PWA manifest & service worker) |
| `npm run preview` | Serve the production bundle locally |
| `npm run seed:business` | Idempotently seed customers/settings/orders (needs `SUPABASE_SECRET_KEY`) |
| `npm run seed:auth` | Create staff auth accounts + profiles (needs `SUPABASE_SECRET_KEY` and both `POS_*_PASSWORD`) |
| `npm run test:unit` | Vitest unit tests — cart oversell guard, order-id generator, stock math, date parsing, date-range scoping |
| `npm run test:sync` | Full offline-first sync integration test against the live DB (40 checks) |
| `npm run test:smoke` | Smoke test of the exact API path the browser uses (reads/writes) |
| `npm run restore:menu` | Restore the seeded menu from bundled data |
| `npm run repair:menu-seq` | Repair the menu identity sequence drift |
| `npm run assets:sizes` | List every image with its dimensions, file size and bytes-per-pixel |

`test:sync` and `test:smoke` load `.env` automatically and clean up after
themselves (restore menu stock, delete probe rows). Every script that signs in
as a staff member reads its password from `POS_CASHIER_PASSWORD` /
`POS_MANAGER_PASSWORD` and exits with instructions if one is missing.

---

## Testing & Quality Assurance

The project ships with a three-layer verification battery:

| Layer | Tool | What it proves | Count |
|---|---|---|---|
| **Unit tests** | Vitest | Cart never oversells stock; order IDs are unique/monotonic; stock reduce/restore math; robust date parsing (incl. Safari & Postgres timestamps); CSV escaping and scoping; date-range filtering; menu-item and customer form validation (incl. duplicate-name rules) | **85 tests** |
| **Sync integration** | Node script vs live Supabase | Full round trip: pre-auth → place order → queue → flush → Postgres row/items/stock → pull → status update → delete + stock restore → undo flows → rename cleanups → baseline restored | **40 checks** |
| **Smoke test** | Node script vs live Supabase | The exact API path the browser uses (auth, menu/orders/items/settings CRUD, cascade delete) | clean |

Run them with `npm run test:unit`, `npm run test:sync`, `npm run test:smoke`.

---

## Deployment (Vercel)

Production is deployed from the GitHub repo (`JeezHeart/react-maison-de-luxe-pos`,
branch `main`) via the Vercel Git integration — **every push auto-deploys**.

Environment Variables in Vercel (scope: **Production**):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Only public values belong here — Vite inlines `VITE_*` variables into the
public bundle, so a secret key there would be exposed to the world.

---

## Security & Keys

- **RLS protects the data.** Anonymous/POST requests get 401/403; only
  `authenticated` staff sessions read/write business tables through Supabase.
- **The new key API** (`sb_publishable_` / `sb_secret_`) replaces the legacy
  `anon` / `service_role` JWTs, which Supabase is retiring by end of 2026.
  Legacy key support is left disabled on the project.
- **If a secret key leaks:** create a new Secret key in Supabase → Settings →
  API Keys, point every admin tool at it, then delete/disable the old key.
- `.env` is gitignored — credentials are never committed.
- **Staff passwords are not in this repository.** They live in Supabase Auth
  and, for the local scripts, in `POS_CASHIER_PASSWORD` / `POS_MANAGER_PASSWORD`
  in your gitignored `.env`. Nothing under `VITE_` is a password. The login
  screen only shows the bundled demo credentials in pure-local mode, so a real
  deployment never displays a working password.
  ⚠️ Anyone who can reach the app can reach the login form — set unique
  passwords, and change them if they were ever reused or published.

---

## Data & Persistence Details

- **localStorage is the cache**, Supabase is the source of truth. Order rows
  appear instantly, then sync via the `luxury_pos_sync_queue`.
- **Menu** — 48 items across 8 categories.
- **Orders** — seeded sample history on first run (`luxury_pos_orders`).
  Tax is backed out of the stored grand total (`subtotal = total ÷ 1.10`, 10% tax).
- **Settings** — restaurant name/contact/address persist locally
  (`pos_restaurant_name`, `pos_restaurant_contact`, `pos_restaurant_address`).
- **Images** — menu-name slugs map to real filenames in `public/assets/images/`
  (including some double-extension files like `.jpg.jpg`). Run
  `npm run assets:sizes` to list every asset with its dimensions, weight and
  bytes-per-pixel; it is how the two logos were found to be carrying roughly 8×
  more pixels than any size the app actually renders them at.
- **Logo assets are deliberately excluded from the service-worker precache.**
  They use a runtime `CacheFirst` rule instead, so the app shell is not held up
  by image weight on first visit.
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
- **Collision-safe order ids** — new orders use epoch-millis + a per-device
  randomized counter, so multiple POS devices can place orders simultaneously;
  the numeric id still sorts newest-first and fits the `bigint` column.
- **Stored timestamps parse anywhere** — the `"YYYY-MM-DD HH:mm:ss"` strings
  are normalized before `new Date()` (Safari-safe), and Postgres microsecond
  timestamps are trimmed, keeping order sorting/report buckets correct.
- **System snapshot** — "Total Users" reflects the live staff count from the
  `profiles` table (falls back to the local estimate while offline).
- **Near-instant register sync** — any queued change (sale, edit, delete,
  undo) triggers a sync pass within ~1.2s (the 30s periodic tick is the
  backstop).

---

## Known Limitations (Honest Notes)

1. **Concurrent last-unit sales across registers.** The cart blocks overselling
   *per register* and the database clamps `stock >= 0`, but two registers that
   both still show stock `1` for the same item — **within the same ~1.2s sync
   window** — can both sell it. No order is ever lost or corrupted; the shared
   stock can merely read one unit too high until a manual count corrects it.
   Fully closing that window needs a server-side atomic step (a Supabase SQL
   function/RPC or Realtime), i.e. a small migration applied from the Supabase
   dashboard — the fix is designed and ready to wire in.

2. **React Router dependency advisories.** `npm audit` reports two *moderate*
   advisories on `react-router-dom` 6.x. Fixing them requires a breaking v7
   upgrade; the reported vector is not reachable with this app's static route
   structure, so the upgrade was intentionally deferred.

---

*Maison de Luxe POS — an offline-first restaurant point-of-sale system.*