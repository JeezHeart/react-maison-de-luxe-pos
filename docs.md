# Maison de Luxe POS — System Documentation

**Deep technical reference for developers, maintainers, and mentors.**

This document explains *how the system is built inside*: the offline-first sync
engine, the data model, the auth/security design, the deployment topology, and
the operational runbook. For the *user-facing* guide (features, screens, roles,
setup), see [README.md](./README.md).

> Status of this document: **2026-09-28** — reflects the live production state
> (Vercel + Render deployed, Supabase migration `0003` applied, QA battery green).

> **In plain English:** this app runs entirely in the browser and keeps a
> personal copy of its data on each device. Every screen saves instantly, and a
> background helper quietly uploads those saves to a shared online database
> (Supabase) and pulls down anything other devices saved — so several cash
> registers stay in agreement without anyone pressing a button. This document
> is a guide to how that machinery works and how to look after it.

---

## 1. System Overview

```
                 ┌──────────────────────────── PWA (React) ───────────────────────────┐
                 │                                                                     │
  Cashier device │  localStorage (cache + sync queue)  ◄───►  Zustand stores            │
  Manager device │        ▲           │                       (orders/menu/customers…)  │
                 │        │           │  enqueue()              ▲                       │
                 │        └───────────┴── flushQueue() ─────────┘                       │
                 └───────────────────────────────┬─────────────────────────────────────┘
                                                 │  Supabase REST (PostgREST)
                                                 ▼
                          ┌──────────────────────────────────────────────┐
                          │  Supabase — Postgres (source of truth) + RLS │
                          │  Auth: staff accounts (cashier/manager)      │
                          └──────────────────────────────────────────────┘
```

**Core principles** (they drive every design decision in this repo):

1. **Local-first reads.** The UI never waits on the network. Every screen reads
   from `localStorage` (seeded on first run), so the register paints instantly
   and works with zero connectivity.
2. **Queue-based writes.** Every write updates `localStorage` immediately and is
   appended to a persistent outbox (`luxury_pos_sync_queue`). When online, the
   queue is replayed against Supabase, then the shared state is pulled back
   down. Supabase is the source of truth; localStorage is the cache.
3. **Cloud wins on pull — but only after the queue is flushed.** This ordering
   is what makes multi-register consistency safe: nothing locally unique is
   ever overwritten by a stale server snapshot.
4. **Rollout order independence.** The app detects missing database features
   (e.g. the atomic-stock function) and degrades gracefully, so frontend and
   database can be deployed in any order.

---

## 2. Persistence — localStorage keys

| Key | What it holds |
|---|---|
| `luxury_pos_menu` | Menu items + category list (seeded 48 items on first run) |
| `luxury_pos_orders` | Order history (seeded sample history on first run) |
| `luxury_pos_customers` | Customer directory (seeded 15 on first run) |
| `pos_restaurant_name` / `pos_restaurant_contact` / `pos_restaurant_address` | Restaurant profile fields |
| `luxury_pos_auth` | Cached signed-in user (username/email/name/role) |
| `luxury_pos_sync_queue` | The outbox of pending cloud writes (see §3) |
| `luxury_pos_order_seq` | Per-device randomized ID suffix (persisted forever) |
| `luxury_pos_order_last_id` | Last generated order id (collision guard) |

---

## 3. The Sync Engine (`src/lib/sync.js` + `syncController.js`)

> **In plain words:** changes are never sent to the cloud one-by-one as they
> happen. They are dropped into a "to-do list" (the queue) saved on the device,
> and a background helper works through that list whenever the device has a
> connection, then refreshes the local copy from the cloud. If the internet
> fails, the list simply waits and resumes later — nothing is lost.

### 3.1 Queue op shapes

A queue op is a single flat object with `{ table, action, ... }`:
`ts` is appended by `enqueue()`.

| table | action | payload | Notes |
|---|---|---|---|
| `orders` | `insert` | full order (has `id`) | Creates row + `order_items` |
| `orders` | `update` | `{ order_status }` | Status drag-and-drop |
| `orders` | `delete` | — (uses `id`) | Row + items cascade; stock restored |
| `menu` | `upsert` | full item | Unique by `name`; **never** writes `stock` on edits |
| `menu` | `delete` | — (uses `name`) | |
| `stock` | `increment`/`decrement` | `{ name, qty }` | Salted into `apply_stock_movement(name, ±qty)` |
| `stockSet` | (set) | `{ name, stock }` | Manager recount → `set_menu_item_stock` |
| `customers` | `upsert`/`delete` | full customer / `name` | Unique by `name` |
| `settings` | `upsert` | `{ key, value }` | Restaurant profile |

### 3.2 enqueue() and near-real-time triggers

- `enqueue(op)` no-ops when Supabase is **not** configured (pure local mode).
- After appending, it fires every registered `onQueueChange()` listener.
- The sync controller re-arms a **~1.2 s debounce** on any queue change, so a
  sale on Register A lands on Register B within a couple of seconds — the 30 s
  periodic tick is only the backstop.
- The queue is trimmed on every write: ops older than **7 days** are dropped so
  one poisoned row can never wedge the register forever.

### 3.3 A sync pass does: flush → pull → merge

1. `flushQueue()` replays the queue top-to-bottom through per-table dispatchers.
   A failed op stays queued and does not block unrelated ops (independent
   tables/rows don't depend on each other).
2. After the flush, each store's `syncFromRemote` pulls the full remote set and
   replaces local state ("remote wins"), which is safe because **by then every
   local write is already in the cloud**.

### 3.4 Sync pass triggers

| Trigger | When |
|---|---|
| After successful sign-in | `runSync('login')` |
| Browser `online` event | `runSync('online')` |
| Periodic tick | Every 30 s while signed in |
| New queued work | ~1.2 s after the last `enqueue()` (`onQueueChange`) |

The UI exposes a **Syncing… / Synced / Offline** dot (`uiStore.setSyncState`);
it is hidden entirely in pure-local mode.

---

## 4. Atomic Stock (the multi-register oversell fix)

> **In plain words:** the fix for "two registers sell the same last dish at the
> same time." Instead of each register writing its own guess of the new stock
> count, the database itself subtracts servings one at a time. Whichever
> register arrives second is told the dish is gone, and the app flags it for a
> manual check — nobody's numbers silently overwrite each other.

Prior design: the browser computed an **absolute** stock number and upserted it.
Two registers selling the same last unit each wrote their own value and the last
write won — a *silent* lost update.

Current design (migration `0003`, **applied to the live DB**):

| Operation | How it reaches Postgres |
|---|---|
| Sale / undo-delete restock | `apply_stock_movement(name, ±qty)` — row lock (`SELECT … FOR UPDATE`), signed delta, clamped at 0, returns `(item_name, stock, shortfall)` |
| Manager recount (menu editor) | `set_menu_item_stock(name, count)` — authoritative absolute set, clamped at 0 |
| Brand-new item (or rename to a new name) | Seeds its own `stock` on insert — the **only** absolute write |
| Any other menu edit (price, description) | Sends **no** `stock` column at all |

Key properties:

- Both functions are **`security invoker`** with `search_path = public`, so
  Row Level Security still applies — they can do nothing the calling role
  couldn't already do.
- `EXECUTE` is **revoked from `anon`**, so anonymous callers can't move stock
  (42501) — defense in depth on top of RLS.
- **Shortfall handling:** when a movement can't be fully satisfied, the server
  reports `shortfall > 0`; `dispatchStock` raises a toast naming the item so a
  real person can recount. The sale itself is still recorded — the money
  changed hands — but the shared count is known to be off.
- **Graceful fallback:** `isMissingFunction()` detects Postgres error codes
  `PGRST202` / `42883` (or "could not find the function"/"does not exist") and
  falls back to a non-atomic read-modify-write with a one-time console warning.
  This keeps deployments order-independent. The `test:sync` suite prints
  `SKIP atomic stock race` while the fallback is active and runs the real
  two-simultaneous-sales case once the functions exist.

Verified live: `test:sync` now passes the oversell-race checks
(`satisfied=1 refused=1`, stock floors at 0, recount sets exact count, anon
caller refused, no residue).

---

## 5. Order Identity

> **In plain words:** every order gets a unique number made from the current
> time combined with a random "device number" saved on that device, so two
> registers can place orders at the exact same moment and never collide.

`nextOrderId()` (in `orderStore`) produces collision-safe 16‑digit numeric IDs:

```
id = Date.now() × 1000  +  perDeviceSuffix
```

- `perDeviceSuffix` is a random **100–999** chosen once per device and
  persisted in `luxury_pos_order_seq`.
- `Date.now() × 1000` grows strictly; the suffix keeps two devices whose clocks
  collide in the same millisecond from producing the same id.
- `luxury_pos_order_last_id` additionally guards the common case: if a burst of
  orders lands within one millisecond, the counter is bumped forward so IDs on
  the device stay strictly increasing.
- The numeric form fits a `bigint` column and **sorts newest-first** naturally.

---

## 6. Zustand Store Map

| Store | Holds | Notable invariants |
|---|---|---|
| `cartStore` | Invoice cart lines | Caps quantity at remaining stock on add and `+` (across add-on variants) |
| `orderStore` | Orders + derived totals | `nextOrderId()`; place/delete/restore keep stock in sync; `syncFromRemote` |
| `menuStore` | Menu & categories | `LOW_STOCK_THRESHOLD = 5`; reduce/restore stock; rename cleans up renamed item rows |
| `customerStore` | Customer directory | Rejects duplicate names; undo restore on delete |
| `settingsStore` | Restaurant profile | name/contact/address keys; cleans input |
| `authStore` | Session + role + manager window | Online: Supabase Auth; offline: bundled demo; `authorizeManager` window = 5 min |
| `uiStore` | Toasts, product modal, add-ons, sync state | — |

---

## 7. Auth & Security

> **In plain words:** staff logs in with a username and password that only
> exist in the cloud — nothing secret is baked into the app. Even the cashier's
> "delete order" approval is the manager's real password, checked live, so
> there is no hidden code to reverse-engineer.

### 7.1 Sign-in

- Username login maps to a Supabase Auth account:
  `cashier` → `cashier@maison.de.luxe`, `manager` → `manager@maison.de.luxe`.
- With Supabase configured, `login()` calls `supabase.auth.signInWithPassword()`
  and reads `role`/`name` from `profiles` (falling back to `user_metadata`).
- Sessions persist (`luxury_pos_auth`); on app load `init()` restores the
  Supabase session so a refresh keeps you signed in.
- **Pure-local mode** (no Supabase credentials): falls back to two bundled demo
  accounts in `authStore.ACCOUNTS`, deliberately prefixed `demo-` so nothing in
  the shipped bundle can ever be mistaken for — or collide with — a real staff
  credential. The login screen only shows these hints when Supabase is NOT
  configured, so a real deployment never prints a working password.

### 7.2 Manager PIN (deleting orders as cashier)

- The "PIN" is the **manager account's real password**, verified against
  Supabase Auth.
- `verifyPassword()` (in `src/lib/supabase.js`) signs in with a **throwaway**
  client (`persistSession: false`) just to check the credential, then discards
  it (`signOut()`). The cashier's own session is untouched, and no PIN exists
  in the bundle to copy.
- On success, a 5-minute authorization window opens (`managerAuthorizedUntil`),
  so several deletions don't re-prompt.
- Returns `null` when Supabase isn't configured → caller falls back to the
  local demo accounts.

### 7.3 Key hygiene

| Variable | Where it lives | Safe to ship in the bundle? |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env`, Vercel/Render build env | ✅ yes (public) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`) | `.env`, build env | ✅ yes (public) |
| `VITE_SUPABASE_ANON_KEY` (`eyJ…`) | `.env` | ✅ legacy fallback, public |
| `POS_CASHIER_PASSWORD` / `POS_MANAGER_PASSWORD` | local `.env` only (never `VITE_`, never committed) | ❌ **no** — never bundled |
| `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | environment of admin **scripts** only | ❌ **never** |

`src/lib/supabase.js` reads `VITE_*` from `import.meta.env` (or `process.env`
when imported in Node scripts), prefers the publishable key, and treats the
app as unconfigured (pure local) if either URL or key is blank.

### 7.4 Database security (RLS)

- Applied by `0001_initial_schema.sql`: Row Level Security on every business
  table; only the `authenticated` role can read/write; the `anon` role gets
  `401`/`403` (verified live by `check:live`).
- Database functions are `security invoker` and `EXECUTE` is revoked from
  `anon`.

---

## 8. Database Schema & Migrations

Applied via the Supabase dashboard SQL editor (or `supabase db push`).

| Migration | Contents |
|---|---|
| `0001_initial_schema.sql` | Tables (see below) + RLS policies + role grants + check constraints (`payment_method`, `order_status`, `stock >= 0`) |
| `0002_seed_data.sql` | Seed rows (menu, customers, settings) |
| `0003_atomic_stock.sql` | `apply_stock_movement(text, integer)` and `set_menu_item_stock(text, integer)` (see §4) |

| Table | Purpose | Notable columns / constraints |
|---|---|---|
| `menu_items` | Product catalog | `name` unique, `category`, `price`, `stock check (stock >= 0)`, `updated_at` |
| `orders` | Sales | `id bigint` (app-generated), `customer_name`, `order_type`, `sub_total`, `discount_amount`, `tax_amount`, `total_amount`, `payment_method` (check), `order_status` (check: Pending/Completed/Cancelled), `cashier_name`, `created_at timestamptz` |
| `order_items` | Line items | `order_id` FK **on delete cascade**, `name`, `quantity`, `unit_price`, `subtotal` |
| `customers` | Loyalty directory | `name` unique, `phone`, `email`, `visits`, `total_spent`, `tier` |
| `settings` | Key/value profile | `key` unique (name/contact/address), `value` |
| `profiles` | Staff for the UI | `id` FK → `auth.users`, `role`, `name` |

Re-running the raw SQL files is **not** idempotent (`create policy` fails on
the second run); only the seed *scripts* are safe to re-run.

---

## 9. Scripts & Tooling

| Script | Command | Needs |
|---|---|---|
| Seed business data | `npm run seed:business` | `SUPABASE_URL` + `SUPABASE_SECRET_KEY` (process env) |
| Seed staff accounts | `npm run seed:auth` | Same + `POS_*_PASSWORD` guess: the seeder sets those exact passwords on the Auth accounts |
| Unit tests | `npm run test:unit` | none (skips the `.env` collision check if `.env` is absent; requires both `POS_*` keys when `.env` is present) |
| Live sync integration | `npm run test:sync` | `.env` with `VITE_*` + `POS_CASHIER_PASSWORD` |
| Live smoke | `npm run test:smoke` | same as `test:sync` |
| Live deployment check | `npm run check:live [URL]` | same; defaults to the Vercel URL |
| Write staff passwords | `npm run set:staff-passwords` | interactive hidden prompt; writes to `.env` |
| Restore menu | `npm run restore:menu -- --apply` | `SUPABASE_SECRET_KEY` |
| Repair menu sequence | `npm run repair:menu-seq` | `SUPABASE_SECRET_KEY` |
| Image audit | `npm run assets:sizes` | none |
| Diagram render | `npm run render:diagrams` | none (uses public mermaid.ink; writes `docs/img/*.svg`) |

`seed:auth` is create-only: it does **not** overwrite an existing account's
password (Supabase rejects duplicate emails). To rotate, use the dashboard
(§10.3). `set:staff-passwords` refuses the once-published values and enforces
12+ characters.

---

## 10. Operational Runbook

### 10.1 Apply a migration
Supabase → **SQL Editor** → paste the migration file → **Run**. Confirm the
atomic functions with `npm run test:sync` (the `SKIP atomic stock race` banner
disappears).

### 10.2 Verify a deployment right after a push
```powershell
npm run check:live                         # Vercel
npm run check:live -- https://maisondeluxe-pos.onrender.com   # Render
```
Each check: page responds → logo served at web size → anonymous read refused
(RLS) → staff sign-in works from that origin → authenticated read returns rows.

### 10.3 Rotate staff passwords
1. Reset the passwords in Supabase → **Authentication → Users** (or directly
   via `update auth.users set encrypted_password = crypt(…, gen_salt('bf'))`).
2. Re-sync the local/script copy: `npm run set:staff-passwords`.
3. ⚠️ Rotating a password does **not** evict sessions issued with the old one —
   delete stale rows from `auth.sessions` if anyone could have signed in while
   the old password was public.

### 10.4 Recover from (almost) anything
- **Menu wrecked:** `npm run restore:menu -- --apply`
- **Duplicate menu ids / sequence drift:** `npm run repair:menu-seq`
- **"apply_stock_movement is missing" in the console:** apply `0003_atomic_stock.sql`
- **Sign-in says invalid credentials:** password in Supabase Auth ≠ the `POS_*`
  value used by scripts (or a typo in `.env`) — re-check §10.3
- **PWA won't install on a host:** confirm the manifest is served with
  `Content-Type: application/manifest+json` (Render needs a Custom Headers rule, §11.3)
- **A register is "stuck":** the queue self-trims after 7 days; check the
  sync-status dot and the browser console for failed ops

---

## 11. Deployment Topology

### 11.1 Vercel (primary)
- Git integration on `main` — **every push auto-deploys**.
- Build-time env vars (public only): `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY`. Never a secret key.
- SPA fallback is handled by Vercel's framework preset automatic.

### 11.2 Render (secondary, demo-friendly)
- `render.yaml` at the repo root defines a **static site** (`maisondeluxe-pos`),
  build `npm run build`, publish dir `dist`, same two public env vars.
- Render serves `<name>.onrender.com` on a free, always-on static plan.
- The blueprint declares the **SPA fallback as a route** (`routes: [rewrite
  /* → /index.html]`), so deep links (`/pos`, `/login`, `/receipt/:id`) work
  with zero dashboard setup — the rule auto-applies on every deploy.
- The repo's `public/_redirects` is **not** honored by Render (it reads the
  blueprint/dashboard rules instead). The file is harmless to ship (it
  activates if the build is ever hosted on Netlify).

### 11.3 Render routing & headers
| Concern | Where it's declared | Rule |
|---|---|---|
| SPA fallback | **`render.yaml` blueprint routes** (auto-applied each deploy) — or the equivalent dashboard **Redirects/Rewrites** rule when not using the blueprint | Source `/*` → Destination `/index.html` → **Rewrite** |
| Manifest MIME type | Dashboard **Custom Headers** (one-time); can equivalently be added as a blueprint `headers:` block | Path `/manifest.webmanifest` → `Content-Type: application/manifest+json` |

Render only applies rules to **non-existent paths**, so real files (assets,
`sw.js`) are served normally.

### 11.4 PWA
`vite-plugin-pwa` `generateSW` precaches the app shell (15 entries today,
~1 MiB). Logo images use a runtime `CacheFirst` rule instead of precache so
first paint isn't blocked by image weight. Service worker + manifest are
served by both hosts (verified live).

---

## 12. Testing & QA Strategy

| Layer | Tool | What it proves |
|---|---|---|
| Unit (118) | Vitest | Cart oversell guard; order-ID uniqueness/monotonic; stock reduce/restore math; date parsing (Safari + Postgres); CSV escaping & scoping; date-range filtering; menu/customer form validation; demo creds can never collide with live staff passwords; manager PIN is server-checked; atomic-stock fallback path |
| Live sync (46) | Node vs live Supabase | Full round trip: login → place order → queue → flush → Postgres row/items/stock → pull → status update → delete + stock restore → undo flows → rename cleanups → oversell race → baseline restored |
| Smoke | Node vs live Supabase | The exact API path the browser uses (auth, CRUD, cascade) |
| Deploy check | `check:live` | Each hosted origin end-to-end, read-only |

Run everything after a password change or config change; `test:sync` restores
baseline state (menu stock 15, no residue, probe rows deleted).

---

## 13. Change Log (recent)

- **Security overhaul (12 commits):** staff passwords removed from the repo;
  manager PIN verified against Supabase Auth; `set:staff-passwords` hidden
  prompt; `check:live`; logo files shrunk; admin/report routes lazy-loaded;
  CSV export scoping fixed; `.gitignore`/`.vercelignore` cleaned.
- **Atomic stock:** migration `0003` applied to the live DB — the multi-register
  oversell race is closed and verified (`test:sync` runs the race case).
- **Render deployment:** blueprints, SPA rewrite + manifest header rules applied.
- **QA battery:** 118 unit / 46 sync / smoke / 2× `check:live` all green.

---

## 14. Known Limitations (current)

1. **Concurrent last-unit sales.** Closed for deployments with migration `0003`
   (atomic stock). Before the migration is applied, the app falls back to a
   non-atomic write (documented, console-warned) and the *per-register* cart
   guard + DB `stock >= 0` clamp still prevent negative stock — but the window
   reopens until `0003` is applied. **This deployment has `0003` applied.**
2. **React Router dependency advisories.** Two *moderate* `npm audit`
   advisories on `react-router-dom` 6.x. Fixing them requires a breaking v7
   upgrade; the reported vector is not reachable with this app's static route
   structure, so the upgrade was intentionally deferred.
3. **Catch-all SPA fallback on static hosts.** Unknown paths return the app
   shell (200 + HTML) rather than a true 404 — standard SPA behaviour, fine for
   this app. A typo'd *asset* path will surface as a client-side MIME error
   rather than a clean 404.
4. **Accepted risk (recorded in README):** staff password strength was
   previously weak and published; rotation is ongoing and the owner accepts the
   trade-off. Rotated values live only in Supabase Auth and the owner's `.env`.

---

*Maison de Luxe POS — offline-first point-of-sale system. See the README for
the feature & user guide, and the Supabase dashboard for the live project
(`iqrfcdrhsgtyxijdpicl`).*