# 📈 Dividend Portfolio Tracker

A full-stack personal finance web app for tracking Indian stock, REIT and InvIT portfolios with dividend management, built with React + Vite + Express + Excel as a DB.

---

## ✨ Features

| Tab | Description |
|---|---|
| **📈 Portfolio** | Holdings table with P&L, dividend yield, TDS calculations. Filter by type, search by name, sort any column. |
| **📊 Charts** | Recharts visualisations — allocation pie, type breakdown, P&L bar, gross vs net dividend bar. |
| **📅 Div Calendar** | Month-wise dividend calendar (2026–2040) driven by actual Div Tracker entries. |
| **⚡ Quick Update** | Tab through all stocks, update current prices inline, bulk-save to Excel in one click. |
| **🎯 Income Goal** | Monthly passive income target with progress bar, milestone tracker (₹5k → ₹1L), investment gap calculator. |
| **📋 Div Tracker** | Month-wise dividend ledger (2026–2040). Log every dividend received — auto-syncs to Div Calendar. |
| **🗄️ Excel Store** | View Excel DB status, download files, raw data preview, clear all records. |

---

## 🏗️ Tech Stack

- **Frontend** — React 18, Vite, Tailwind CSS, Framer Motion, Recharts, Lucide Icons
- **Backend** — Node.js, Express
- **Database** — SheetJS (xlsx) — portfolio and dividends stored as `.xlsx` files
- **No cloud DB required** — everything lives in `data/` folder

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm

### Install & Run

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/dividend-portfolio-tracker.git
cd dividend-portfolio-tracker

# Install dependencies
npm install

# Start both API server + Vite dev server together
npm run dev
```

App opens at **http://localhost:5173**
API runs at **http://localhost:3001**

### Run separately (optional)
```bash
npm run server   # Express API only
npm run ui       # Vite frontend only
```

---

## 📁 Project Structure

```
├── server.js                          # Express API — portfolio & dividends CRUD
├── portfolio_dividend_tracker_app_react.jsx  # Root shell + 7-tab navigation
├── vite.config.js                     # Vite config + API proxy
├── src/
│   ├── lib/
│   │   ├── api.js                     # All fetch helpers (single source of truth)
│   │   └── constants.js               # Shared types, colours, calc functions
│   ├── components/ui/                 # button, card, input
│   └── views/
│       ├── PortfolioView.jsx          # Holdings table + filter + sort
│       ├── ChartsView.jsx             # Recharts visualisations
│       ├── CalendarView.jsx           # Dividend calendar from tracker data
│       ├── QuickUpdateView.jsx        # Bulk price update
│       ├── GoalView.jsx               # Monthly income goal tracker
│       ├── DividendTrackerView.jsx    # Month-wise dividend ledger
│       └── DataStoreView.jsx          # Excel DB manager
└── data/                              # ← gitignored (your private data lives here)
    ├── portfolio.xlsx                 # Stock holdings DB
    └── dividends.xlsx                 # Dividend ledger DB
```

---

## 🔒 Data Privacy

All personal financial data (`data/*.xlsx`) is **gitignored** and never committed.
The `data/` folder is created automatically on first run.

---

## 📐 How the Excel DB Works

```
App (Add/Edit/Delete)
  → POST/PUT/DELETE /api/portfolio
  → Express :3001
  → data/portfolio.xlsx

data/portfolio.xlsx
  → Express :3001
  → GET /api/portfolio
  → All views auto-populated
```

---

## 📊 Supported Asset Types

| Type | TDS Treatment | Dividend Frequency |
|---|---|---|
| **Equity** | TDS @10% if div ≥ ₹5,000/company/year | Annual |
| **REIT** | Taxed as other income at slab rate | Quarterly |
| **InvIT** | Taxed as other income at slab rate | Quarterly |

---

## 🛠️ To restart the app next time

```bash
cd "Portfolio Tracker"
npm run dev
```

---

*Built with ❤️ for passive income tracking*
