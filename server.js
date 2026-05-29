/**
 * Portfolio Tracker — Express backend
 * Reads / writes portfolio data to data/portfolio.xlsx
 * Serves the React production build cleanly via Express v5
 */

import express from "express";
import cors from "cors";
import XLSX from "xlsx";
import { existsSync, mkdirSync, statSync, copyFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Render supports normal persistent directories; falls back cleanly to local data folder
const IS_PROD = process.env.NODE_ENV === "production";
const DATA_DIR = path.join(__dirname, "data");

const XLSX_FILE = path.join(DATA_DIR, "portfolio.xlsx");
const SHEET     = "Portfolio";
const PORT      = process.env.PORT || 3001;
const DIST_DIR  = path.join(__dirname, "dist");

// ── helpers ──────────────────────────────────────────────────────────────────

/** Column headers — must match what Python seeder wrote */
const COLUMNS = [
  "name", "type", "qty", "avgPrice", "currentPrice",
  "dividend", "netDividend", "sector",
];

function ensureFile() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  
  if (!existsSync(XLSX_FILE)) {
    const rootFile = path.join(__dirname, "data", "portfolio.xlsx");
    if (IS_PROD && existsSync(rootFile)) {
      copyFileSync(rootFile, XLSX_FILE);
      console.log("📋 Copied seed portfolio.xlsx to local storage");
    } else {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([COLUMNS]);
      XLSX.utils.book_append_sheet(wb, ws, SHEET);
      XLSX.writeFile(wb, XLSX_FILE);
      console.log("📄 Created new portfolio.xlsx");
    }
  }
}

function readStocks() {
  ensureFile();
  const wb   = XLSX.readFile(XLSX_FILE);
  const ws   = wb.Sheets[SHEET];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  return rows.map((r) => ({
    name:         String(r.name         ?? "").trim(),
    type:         String(r.type         ?? "Equity").trim(),
    qty:          Number(r.qty          ?? 0),
    avgPrice:     Number(r.avgPrice     ?? 0),
    currentPrice: Number(r.currentPrice ?? 0),
    dividend:     Number(r.dividend     ?? 0),
    netDividend:  Number(r.netDividend  ?? 0),   
    sector:       String(r.sector       ?? "").trim(),
  }));
}

function writeStocks(stocks) {
  ensureFile();
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(stocks, { header: COLUMNS });
  XLSX.utils.book_append_sheet(wb, ws, SHEET);
  XLSX.writeFile(wb, XLSX_FILE);
}

// ── server ────────────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

/** GET /api/portfolio — return all stocks */
app.get("/api/portfolio", (_req, res) => {
  try {
    res.json(readStocks());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to read portfolio.xlsx" });
  }
});

/** POST /api/portfolio — add one stock */
app.post("/api/portfolio", (req, res) => {
  try {
    const stocks = readStocks();
    const stock  = sanitise(req.body);
    stocks.push(stock);
    writeStocks(stocks);
    res.status(201).json(stocks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add stock" });
  }
});

/** PUT /api/portfolio — replace entire portfolio (bulk update) */
app.put("/api/portfolio", (req, res) => {
  try {
    const stocks = (req.body ?? []).map(sanitise);
    writeStocks(stocks);
    res.json(stocks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Bulk update failed" });
  }
});

/** PUT /api/portfolio/:index — update stock at index */
app.put("/api/portfolio/:index", (req, res) => {
  try {
    const idx    = Number(req.params.index);
    const stocks = readStocks();
    if (idx < 0 || idx >= stocks.length)
      return res.status(404).json({ error: "Stock not found" });
    stocks[idx] = sanitise(req.body);
    writeStocks(stocks);
    res.json(stocks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update stock" });
  }
});

/** GET /api/portfolio/meta — file info (size, modified, row count) */
app.get("/api/portfolio/meta", (_req, res) => {
  try {
    ensureFile();
    const stat   = statSync(XLSX_FILE);
    const stocks = readStocks();
    res.json({
      file:     "data/portfolio.xlsx",
      fullPath: XLSX_FILE,
      rows:     stocks.length,
      sizeKb:   (stat.size / 1024).toFixed(1),
      modified: stat.mtime.toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to read file metadata" });
  }
});

/** GET /api/portfolio/download — send the xlsx as a file attachment */
app.get("/api/portfolio/download", (_req, res) => {
  try {
    ensureFile();
    res.download(XLSX_FILE, "portfolio.xlsx");
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Download failed" });
  }
});

/** DELETE /api/portfolio — clear ALL stocks */
app.delete("/api/portfolio", (_req, res) => {
  try {
    writeStocks([]);
    res.json([]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to clear portfolio" });
  }
});

/** DELETE /api/portfolio/:index — remove stock at index */
app.delete("/api/portfolio/:index", (req, res) => {
  try {
    const idx    = Number(req.params.index);
    const stocks = readStocks();
    if (idx < 0 || idx >= stocks.length)
      return res.status(404).json({ error: "Stock not found" });
    stocks.splice(idx, 1);
    writeStocks(stocks);
    res.json(stocks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete stock" });
  }
});

function sanitise(body) {
  return {
    name:         String(body.name         ?? "").trim(),
    type:         String(body.type         ?? "Equity").trim(),
    qty:          Number(body.qty          ?? 0),
    avgPrice:     Number(body.avgPrice     ?? 0),
    currentPrice: Number(body.currentPrice ?? 0),
    dividend:     Number(body.dividend     ?? 0),
    netDividend:  Number(body.netDividend  ?? 0),   
    sector:       String(body.sector       ?? "").trim(),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Dividend Tracker  —  data/dividends.xlsx
// ══════════════════════════════════════════════════════════════════════════════

const DIV_FILE  = path.join(DATA_DIR, "dividends.xlsx");
const DIV_SHEET = "Dividends";
const DIV_COLS  = ["id","year","month","stockName","grossDiv","tds","netDiv","notes"];

function ensureDivFile() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DIV_FILE)) {
    const rootDivFile = path.join(__dirname, "data", "dividends.xlsx");
    if (IS_PROD && existsSync(rootDivFile)) {
      copyFileSync(rootDivFile, DIV_FILE);
      console.log("📋 Copied seed dividends.xlsx to local storage");
    } else {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([DIV_COLS]);
      XLSX.utils.book_append_sheet(wb, ws, DIV_SHEET);
      XLSX.writeFile(wb, DIV_FILE);
      console.log("📄 Created new dividends.xlsx");
    }
  }
}

function readDivs() {
  ensureDivFile();
  const wb   = XLSX.readFile(DIV_FILE);
  const ws   = wb.Sheets[DIV_SHEET];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  return rows.map((r) => ({
    id:        String(r.id        ?? ""),
    year:      Number(r.year      ?? 0),
    month:     Number(r.month     ?? 0),
    stockName: String(r.stockName ?? "").trim(),
    grossDiv:  Number(r.grossDiv  ?? 0),
    tds:       Number(r.tds       ?? 0),
    netDiv:    Number(r.netDiv    ?? 0),
    notes:     String(r.notes     ?? "").trim(),
  }));
}

function writeDivs(rows) {
  ensureDivFile();
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows, { header: DIV_COLS });
  XLSX.utils.book_append_sheet(wb, ws, DIV_SHEET);
  XLSX.writeFile(wb, DIV_FILE);
}

function sanitiseDiv(body) {
  return {
    id:        String(body.id        ?? Date.now()),
    year:      Number(body.year      ?? new Date().getFullYear()),
    month:     Number(body.month     ?? new Date().getMonth() + 1),
    stockName: String(body.stockName ?? "").trim(),
    grossDiv:  Number(body.grossDiv  ?? 0),
    tds:       Number(body.tds       ?? 0),
    netDiv:    Number(body.netDiv    ?? 0),
    notes:     String(body.notes     ?? "").trim(),
  };
}

/** GET /api/dividends — all entries */
app.get("/api/dividends", (_req, res) => {
  try { res.json(readDivs()); }
  catch (err) { console.error(err); res.status(500).json({ error: "Failed to read dividends.xlsx" }); }
});

/** POST /api/dividends — add entry */
app.post("/api/dividends", (req, res) => {
  try {
    const rows = readDivs();
    const entry = { ...sanitiseDiv(req.body), id: String(Date.now()) };
    rows.push(entry);
    writeDivs(rows);
    res.status(201).json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed to add dividend entry" }); }
});

/** PUT /api/dividends/:id — update by id */
app.put("/api/dividends/:id", (req, res) => {
  try {
    const rows = readDivs();
    const idx  = rows.findIndex((r) => r.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: "Entry not found" });
    rows[idx] = { ...sanitiseDiv(req.body), id: req.params.id };
    writeDivs(rows);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed to update entry" }); }
});

/** DELETE /api/dividends/:id — delete by id */
app.delete("/api/dividends/:id", (req, res) => {
  try {
    const rows    = readDivs();
    const updated = rows.filter((r) => r.id !== req.params.id);
    writeDivs(updated);
    res.json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed to delete entry" }); }
});

/** GET /api/dividends/download — download dividends.xlsx */
app.get("/api/dividends/download", (_req, res) => {
  try { ensureDivFile(); res.download(DIV_FILE, "dividends.xlsx"); }
  catch (err) { console.error(err); res.status(500).json({ error: "Download failed" }); }
});

// ── Serve built React frontend in production ──────────────────────────────────
if (IS_PROD && existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  
  // 🛠️ EXPRESS V5 REGEX FIX (Catches all UI views while bypassing /api routes)
  app.get(/^(?!\/api).+/, (req, res) => {
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
  console.log(`🌐 Serving React UI from dist/`);
}

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  ensureFile();
  ensureDivFile();
  console.log(`🚀 Portfolio Tracker running at http://localhost:${PORT}`);
  console.log(`📊 Portfolio DB  : ${XLSX_FILE}`);
  console.log(`📋 Dividends DB  : ${DIV_FILE}`);
  console.log(`🔧 Mode          : ${IS_PROD ? "production" : "development"}`);
});
