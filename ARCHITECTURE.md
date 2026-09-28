# Maison de Luxe POS — System Architecture

**The architecture, the diagrams, and the reasoning behind them.**

This document is the *architecture-level* view of the system: components,
data flow, concurrency & consistency model, security architecture, and
deployment topology. Companion docs:

- [README.md](./README.md) — user-facing feature & setup guide
- [docs.md](./docs.md) — deep technical reference and ops runbook

> **About the diagrams:** each diagram is committed as an **SVG image**
> (`docs/img/`) so it renders in *any* Markdown viewer, with the Mermaid
> source kept in a collapsible block beneath it for editing. Regenerate after
> editing with `npm run render:diagrams`.

---

## 1. Architecture at a Glance

The system is fundamentally a **client-side, offline-first POS** that
synchronizes to a **serverless cloud database**. There is no application
server to operate: the "backend" is Supabase (Postgres + Auth + REST), and the
entire business logic runs in the browser.

<p align="center"><img src="docs/img/architecture-1.svg" alt="System architecture overview" style="max-width:100%"></p>

<details>
<summary>Mermaid source (edit, then <code>npm run render:diagrams</code> to refresh the SVG)</summary>

```mermaid
flowchart TB
    subgraph Client["Browser — React PWA (single codebase, any device)"]
        UI["Presentation layer<br/>React components (JSX + Tailwind)"]
        ST["State layer<br/>Zustand stores (cart, orders, menu, …)"]
        SY["Sync layer<br/>sync.js + syncController.js"]
        LS[("localStorage<br/>offset cache + sync queue")]
        PW["Service worker<br/>PWA precache + offline shell"]
    end

    subgraph Cloud["Cloud — Supabase project iqrfcdrhsgtyxijdpicl"]
        REST["PostgREST REST API"]
        PG[("Postgres<br/>business tables + RLS<br/>atomic stock functions")]
        AUTH["Supabase Auth<br/>staff accounts (cashier / manager)"]
    end

    UI --> ST
    ST <--> LS
    ST --> SY
    SY <--> LS
    SY -->|"REST (supabase-js), JWT session"| REST
    REST --> PG
    AUTH --> REST
    PW -. caches assets .-> UI
```

</details>

### Key architectural decisions

| Decision | Why |
|---|---|
| **No custom backend server** | The register must never depend on an in-house server that can go down. Supabase gives Postgres + Auth + REST serverless, always-on, with RLS as the security boundary. |
| **localStorage is the system of record at runtime** | Instant reads/writes → the POS feels native and works airplane-mode. The cloud is the durable, shared source of truth. |
| **Writes go through a queue, never direct** | Turns "the network failed mid-request" into a retryable, durable outbox. |
| **Pull after flush ("remote wins after flush")** | Cleans up convergent multi-register state without ever dropping a locally-unique write. |
| **Stock is owned by the database** | Fixes the silent lost-update oversell bug: the DB serialises movements, so two registers can't both sell the last unit. |
| **PWA shell** | Opens instantly offline after first visit — like a native app on tablets at the counter. |

---

## 2. Component Inventory

```
src/
├── main.jsx / App.jsx      entry; router; role gate; starts sync controller
├── lib/
│   ├── supabase.js         client factory (+ verifyPassword throwaway client)
│   ├── sync.js             queue, enqueue(), flushQueue(), dispatchers
│   └── syncController.js   scheduling: login / online / 30s / ~1.2s queue debounce
├── stores/                 Zustand: cartStore · orderStore · menuStore ·
│                           customerStore · settingsStore · authStore · uiStore
├── pages/                  landing · login · posLayout · adminLayout ·
│                           dashboard · orders · reports · settings · receipt
├── components/             sidebar · invoicePanel · productDetailModal ·
│                           orderDetailsCard · syncStatus · toasts · reportCharts
│   └── settings/           profile · snapshot · reminders · menu mgmt ·
│                           customer directory · manager gate · editor modals
├── utils/                  format · csv · menu · dateRange · validation (×2)
└── data/                   seed menu (48) · customers (15) · add-ons · images
```

---

## 3. Core Flow — Placing an Order (offline-first end to end)

<p align="center"><img src="docs/img/architecture-2.svg" alt="Placing an order — offline-first sequence" style="max-width:100%"></p>

<details>
<summary>Mermaid source (edit, then <code>npm run render:diagrams</code> to refresh the SVG)</summary>

```mermaid
sequenceDiagram
    autonumber
    actor Cashier
    participant CS as cartStore
    participant OS as orderStore
    participant MS as menuStore
    participant LS as localStorage
    participant SY as sync.js
    participant DB as Supabase

    Cashier->>CS: "add items / change qty"
    CS->>CS: "clamp qty to remaining stock"
    Cashier->>OS: "placeOrder(cart, payment…)"
    OS->>OS: "nextOrderId() — collision-safe 16-digit"
    OS->>LS: "persist order (instant — UI done)"
    OS->>MS: "reduce stock locally"
    OS->>SY: "enqueue({orders,insert}) + enqueue({stock,-qty})"
    SY-->>SY: "onQueueChange() fires (~1.2s debounce)"
    SY->>DB: "flushQueue(): insert order + items, apply_stock_movement(-qty)"
    DB-->>SY: "ok (row + items saved, stock moved)"
    SY->>DB: "pull all tables back down"
    DB-->>SY: "current rows"
    SY->>OS: "syncFromRemote() — merge (remote wins)"
    SY->>MS: "syncFromRemote() — stock reconciled cross-register"
```

</details>

**Why this ordering matters:** the order id is assigned and the receipt is
painted before any network I/O. If the network is down, steps 8–11 wait; the
queue persists the intent and replays it later. Even a full browser crash
loses nothing newer than the last successful flush.

---

## 4. The Sync Pass (state machine of a connected register)

<p align="center"><img src="docs/img/architecture-3.svg" alt="Sync pass state machine" style="max-width:100%"></p>

<details>
<summary>Mermaid source (edit, then <code>npm run render:diagrams</code> to refresh the SVG)</summary>

```mermaid
flowchart LR
    S[Start sync pass] --> F{Queue empty?}
    F -- no --> FL[flushQueue: dispatch ops] --> FL2{All sent?}
    FL2 -- retries stay queued --> F
    FL2 -- yes --> P[Pull all tables]
    F -- yes --> P
    P --> M[merge: remote wins after flush]
    M --> D[Done — next trigger: login / online / 30s / queue change]
```

</details>

**Triggers**

| Trigger | Latency target |
|---|---|
| After sign-in | immediate |
| Browser back-online event | immediate |
| Periodic tick (backstop) | every 30 s |
| Any new queued write (`onQueueChange`) | ~1.2 s — this is what makes Register B see Register A's sale within a couple seconds |

**Failure handling:** a failed op stays in the queue (7-day maximum age) but
doesn't block unrelated ops. Independent tables/rows don't depend on each
other, so one bad row can't wedge the register.

---

## 5. Concurrency & Consistency Model

### 5.1 Why registers can't corrupt a shared counter

<p align="center"><img src="docs/img/architecture-4.svg" alt="Atomic stock — two registers racing the last unit" style="max-width:100%"></p>

<details>
<summary>Mermaid source (edit, then <code>npm run render:diagrams</code> to refresh the SVG)</summary>

```mermaid
sequenceDiagram
    autonumber
    participant A as Register A
    participant B as Register B
    participant F as apply_stock_movement(name, -1)
    participant R as menu_items row (stock=1)

    A->>F: "apply(-1)  (both think stock=1)"
    B->>F: "apply(-1)"
    F->>R: "SELECT stock … FOR UPDATE (A grabs the row lock)"
    F->>R: "stock 1 → 0"
    F-->>A: "stock=0, shortfall=0 ✅"
    F->>R: "B now reads stock=0 (blocked until A committed)"
    F->>R: "0 + (-1) → clamp at 0"
    F-->>B: "stock=0, shortfall=1 ⚠️"
    B-->>B: "sale recorded — toast 'shortfall' → someone recounts"
```

</details>

- The DB serialises concurrent movements with a **row lock**, so the second
  seller is told it "came up short" instead of silently driving the number
  negative.
- The sale still stands (the money changed hands) — the shortfall escalates to
  a human rather than disappearing into whichever register synced last.
- Manager **recounts** use `set_menu_item_stock` (absolute-on-purpose), so an
  explicit count is never confused with a movement.
- Anonymous callers are refused (RLS + `EXECUTE` revoked from `anon`).

### 5.2 Order ID uniqueness

<p align="center"><img src="docs/img/architecture-5.svg" alt="Order ID construction" style="max-width:100%"></p>

<details>
<summary>Mermaid source (edit, then <code>npm run render:diagrams</code> to refresh the SVG)</summary>

```mermaid
flowchart LR
    A["Date.now() × 1000"] --> I
    B["per-device random 100–999<br/>(persisted in localStorage)"] --> I
    I["16-digit bigint <br/>monotonic per device"] --> C["newest-first sort<br/>no collision between two devices<br/>in the same millisecond"]
```

</details>

### 5.3 Conflict resolution

| Conflict | Rule |
|---|---|
| Local order vs remote | Merge by id; remote is authoritative once the queue is flushed |
| Menu item renamed on two devices | Rename dispatcher keeps the new row and cleans up the old; last-flushed wins |
| Same customer name added twice | Unique constraint on `name` → duplicate rejected client-side first |
| Deleted order vs stock | Delete restores stock through `apply_stock_movement(+qty)`; undo re-inserts |

---

## 6. Security Architecture

<p align="center"><img src="docs/img/architecture-6.svg" alt="Security architecture" style="max-width:100%"></p>

<details>
<summary>Mermaid source (edit, then <code>npm run render:diagrams</code> to refresh the SVG)</summary>

```mermaid
flowchart TB
    subgraph Edge["Edge (public)"]
        V["VITE_SUPABASE_URL (public)"]
        P["VITE_SUPABASE_PUBLISHABLE_KEY (public)"]
    end
    subgraph Secret["Never leaves the owner's machine"]
        S["SUPABASE_SECRET_KEY<br/>admin scripts only"]
        PW["POS_CASHIER_PASSWORD / POS_MANAGER_PASSWORD<br/>.env (gitignored)"]
    end
    subgraph Runtime["Runtime auth"]
        J["JWT via supabase.auth session"]
    end
    App["Browser app"] -->|anon/publishable key + JWT| RLS["Postgres RLS<br/>authenticated only"]
    Secret -->|admin client| SC["Supabase Admin<br/>(seeders, repair scripts)"]
    App --> Runtime
```

</details>

- **Row Level Security** is the trust boundary: `anon` gets 401/403;
  `authenticated` (a real staff session) can read/write business tables.
- **No hardcoded credentials**: staff passwords live in Supabase Auth; the
  bundle only contains `demo-` prefixed placeholders that pass a guard test
  proving they can never equal a live password.
- **Manager PIN** = the manager's real password, checked through a throwaway
  Supabase client so the cashier's own session is never swapped. There is no
  PIN in the codebase to copy.
- **Database functions are `security invoker`**, so they can't escalate
  privileges beyond the calling role.

---

## 7. Deployment Architecture

<p align="center"><img src="docs/img/architecture-7.svg" alt="Deployment architecture" style="max-width:100%"></p>

<details>
<summary>Mermaid source (edit, then <code>npm run render:diagrams</code> to refresh the SVG)</summary>

```mermaid
flowchart LR
    subgraph GitHub["GitHub — JeezHeart/react-maison-de-luxe-pos (main)"]
        CODE["Vite PWA + docs + migrations"]
    end
    subgraph Vercel["Vercel (primary)"]
        V["maison-de-luxe-pos.vercel.app"]
    end
    subgraph Render["Render (secondary / demo)"]
        R["maisondeluxe-pos.onrender.com<br/>static site via render.yaml"]
    end
    CODE -->|auto-deploy on push| V
    CODE -->|auto-deploy on push| R
    V -->|REST + JWT| SUP[("Supabase<br/>iqrfcdrhsgtyxijdpicl")]
    R --> SUP
```

</details>

- Both hosts serve the **same static bundle** — the app is host-agnostic by
  design (PWA + REST). Vercel is primary; Render is a redundant, free,
  always-on demo URL.
- Build-time env vars (public only) are identical on both hosts.
- Render specifics are declared in `render.yaml`: the SPA fallback is a
  blueprint `routes` rewrite (`/* → /index.html`), so deep links work with no
  dashboard setup; the manifest `Content-Type` is a dashboard Custom Header
  rule (or an equivalent blueprint `headers:` block).
- Migrations are applied from the Supabase dashboard (not by the hosts).

---

## 8. Failure & Recovery Model

| Failure | What happens | Recovery |
|---|---|---|
| No internet at the counter | POS fully usable; writes queue locally | Flushes automatically on reconnect |
| Browser crash mid-order | Order + queue persisted in localStorage | Restored on next load; queue replays |
| A queued op keeps failing | Stays queued (7-day TTL), others proceed | Fix cause; it drains on next pass |
| Supabase unavailable | Reads serve from localStorage | N/A — nothing blocking |
| Migration not applied yet | App detects missing function, falls back, warns once | Apply `0003`; restart app |
| Two registers race the last unit | One sale accepted, one shortfall-toast | Recount that item (never audit-holes the sale) |
| Supervisor deletes an order by mistake | Stock restored; 4s Undo toast | Instant undo re-inserts + re-syncs |

---

## 9. Where Each Concern Lives in Code

| Concern | Files |
|---|---|
| Offline-first sync engine | `src/lib/sync.js`, `src/lib/syncController.js` |
| Auth + session + PIN | `src/lib/supabase.js`, `src/stores/authStore.js` |
| Atomic stock decisions | `src/lib/sync.js` dispatchers, `supabase/migrations/0003_atomic_stock.sql` |
| Order identity | `src/stores/orderStore.js` (`nextOrderId`) |
| Business state | `src/stores/*` (Zustand) |
| Money formatting, date parsing, CSV | `src/utils/*` |
| PWA | `vite.config.js` (`vite-plugin-pwa`), `public/` |
| Schema / migrations / RLS | `supabase/migrations/*.sql` |
| QA battery | `tests/`, `scripts/test-sync-flow.mjs`, `scripts/smoke-test.mjs`, `scripts/check-live.mjs` |

---

*Maison de Luxe POS — react Vite PWA + Supabase. Diagrams live as SVG images
(`docs/img/`, regenerated from the Mermaid source above with
`npm run render:diagrams`), so they display in any Markdown viewer.
See README/docs for context.*