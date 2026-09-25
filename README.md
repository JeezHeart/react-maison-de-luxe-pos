# Maison de Luxe POS

A modern point-of-sale web application for a luxury restaurant. Built with
**React** and **Tailwind CSS**, it provides a responsive cashier dashboard with
menu ordering, an invoice cart, order history, sales reports, and settings.

Runs entirely in the browser — menu data, order history, and restaurant
settings are persisted in `localStorage`, and menu photos ship as static
assets. No backend or database is required.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| UI | React 18 + JavaScript (JSX) |
| Styling | Tailwind CSS 3 + custom luxury theme (`src/index.css`) |
| Build | Vite 5 |
| Routing | React Router 6 (BrowserRouter, SPA) |
| State | Zustand (cart, orders, UI, settings) |
| Icons | Lucide React |
| Persistence | Browser localStorage |
| Deployment | Docker + Nginx (multi-stage build, SPA fallback) |

---

## Features

| Module | Description |
|--------|-------------|
| **Landing page** | Marketing-style home before entering the POS |
| **Dashboard (Menu)** | Browse menu by category, search, product detail modal with add-ons, live invoice cart |
| **Orders** | Order history, order details, print receipt, delete orders, CSV export |
| **Reports** | Sales stats, top-selling items, payment breakdown with date filters |
| **Settings** | Restaurant profile (browser storage) + system snapshot |

---

## Project Structure

```
├── Dockerfile              # node build stage -> nginx runtime stage
├── nginx.conf              # SPA fallback + asset caching
├── docker-compose.yml      # serve on http://localhost:8080
├── index.html
├── public/
│   └── assets/images/      # Menu photos and brand logos
├── src/
│   ├── main.jsx            # React entry (BrowserRouter)
│   ├── App.jsx             # Routes: / , /pos/* , /receipt/:id
│   ├── index.css           # Luxury dark + gold theme
│   ├── data/               # menu.js (48 items) · addons.js · imageFiles.js
│   ├── utils/              # format.js (₱/dates) · menu.js (images/nutrition) · csv.js
│   ├── stores/             # cartStore · orderStore · uiStore · settingsStore
│   ├── components/         # Sidebar · InvoicePanel · ProductDetailModal · ...
│   └── pages/              # LandingPage · PosLayout · Dashboard/Orders/Reports/Settings · ReceiptPage
```

---

## Routes

| Route | Content |
|-------|---------|
| `/` | Landing page (marketing home, "Open POS" starts the app) |
| `/pos` | Dashboard — menu grid, search, categories, product modal + add-ons, invoice panel |
| `/pos/orders` | Orders — history table, order details, delete, print receipt, CSV export |
| `/pos/reports` | Reports — date filters, stats, top items, payment breakdown |
| `/pos/settings` | Settings — restaurant profile (localStorage) + system snapshot |
| `/receipt/:id` | Printable receipt (opens in a new tab) |

Any other path redirects to `/`.

---

## Running Locally

### Dev server

```bash
npm install
npm run dev      # http://localhost:5173
```

### Production build

```bash
npm run build    # outputs to dist/
npm run preview  # serve the production bundle locally
```

### Docker + Nginx

```bash
docker compose up --build
# open http://localhost:8080
```

The multi-stage `Dockerfile` builds the Vite app with Node 20 and serves the
static bundle with Nginx. `nginx.conf` sets up the SPA fallback (all routes
serve `index.html` so `/pos`, `/pos/orders`, and `/receipt/:id` work on
refresh/deep-link) and caches hashed `/assets/` files for a year.

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Build the production bundle into `dist/` |
| `npm run preview` | Serve the production bundle locally |

---

## Data & Persistence

- **Menu** — 48 items across 8 categories.
- **Orders** — seeded with sample history on first run so Orders, Reports, and
  Recent Orders have content. Persisted under `luxury_pos_orders` in
  localStorage. Placing an order appends it in memory + localStorage; delete
  works the same way.
- **Order rows** — tax is backed out of the stored grand total
  (`subtotal = total ÷ 1.10`, 10% tax).
- **Settings** — restaurant name/contact/address persist via localStorage
  (`pos_restaurant_name`, `pos_restaurant_contact`, `pos_restaurant_address`).
- **Images** — menu-name slugs are mapped to real filenames in
  `public/assets/images/` (including some double-extension files like
  `.jpg.jpg`).
- **Nutrition** — computed from price and stock:
  `calories = price × 8.5`, `carbs = (stock % 20) + 15`,
  `protein = (stock % 18) + 12`, `fat = (stock % 14) + 8`.
- **CSV export** — generated fully client-side with the same columns shown in
  the Orders table.