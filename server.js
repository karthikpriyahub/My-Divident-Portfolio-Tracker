/**
 * Portfolio Tracker — Express backend
 * Database : Neon PostgreSQL (persistent, free tier)
 * Storage  : pg Pool — data survives Render restarts forever
 * Excel    : XLSX used only for upload/download (backup)
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import XLSX from "xlsx";
import pkg from "pg";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const { Pool } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT     = process.env.PORT || 3001;
const DIST_DIR = path.join(__dirname, "dist");
const IS_PROD  = process.env.NODE_ENV === "production";

// ── Neon PostgreSQL connection pool ───────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

// ── Create tables on first run ────────────────────────────────────────────────

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS portfolio (
      id             SERIAL  PRIMARY KEY,
      name           TEXT    NOT NULL DEFAULT '',
      type           TEXT    NOT NULL DEFAULT 'Equity',
      qty            NUMERIC NOT NULL DEFAULT 0,
      "divQty"       NUMERIC NOT NULL DEFAULT 0,
      "avgPrice"     NUMERIC NOT NULL DEFAULT 0,
      "currentPrice" NUMERIC NOT NULL DEFAULT 0,
      dividend       NUMERIC NOT NULL DEFAULT 0,
      "netDividend"  NUMERIC NOT NULL DEFAULT 0,
      sector         TEXT    NOT NULL DEFAULT '',
      symbol         TEXT    NOT NULL DEFAULT ''
    );
  `);
  // safe migration — add symbol if existing table doesn’t have it
  await pool.query(`ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS symbol TEXT NOT NULL DEFAULT '';`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dividends (
      id           TEXT    PRIMARY KEY,
      year         INTEGER NOT NULL DEFAULT 0,
      month        INTEGER NOT NULL DEFAULT 0,
      "stockName"  TEXT    NOT NULL DEFAULT '',
      "grossDiv"   NUMERIC NOT NULL DEFAULT 0,
      tds          NUMERIC NOT NULL DEFAULT 0,
      "netDiv"     NUMERIC NOT NULL DEFAULT 0,
      notes        TEXT    NOT NULL DEFAULT ''
    );
  `);
  console.log("🗄️  Neon DB tables ready");
}

// ── Row mappers ───────────────────────────────────────────────────────────────

function rowToStock(r) {
  return {
    name:         String(r.name         ?? "").trim(),
    type:         String(r.type         ?? "Equity").trim(),
    qty:          Number(r.qty          ?? 0),
    divQty:       Number(r.divQty       ?? 0),
    avgPrice:     Number(r.avgPrice     ?? 0),
    currentPrice: Number(r.currentPrice ?? 0),
    dividend:     Number(r.dividend     ?? 0),
    netDividend:  Number(r.netDividend  ?? 0),
    sector:       String(r.sector       ?? "").trim(),
    symbol:       String(r.symbol       ?? "").trim(),
  };
}

function rowToDiv(r) {
  return {
    id:        String(r.id        ?? ""),
    year:      Number(r.year      ?? 0),
    month:     Number(r.month     ?? 0),
    stockName: String(r.stockName ?? "").trim(),
    grossDiv:  Number(r.grossDiv  ?? 0),
    tds:       Number(r.tds       ?? 0),
    netDiv:    Number(r.netDiv    ?? 0),
    notes:     String(r.notes     ?? "").trim(),
  };
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function getStocks() {
  const { rows } = await pool.query(
    `SELECT name, type, qty, "divQty", "avgPrice", "currentPrice",
            dividend, "netDividend", sector, symbol
     FROM portfolio ORDER BY id`
  );
  return rows.map(rowToStock);
}

async function setStocks(stocks) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM portfolio");
    for (const s of stocks) {
      await client.query(
        `INSERT INTO portfolio
           (name, type, qty, "divQty", "avgPrice", "currentPrice",
            dividend, "netDividend", sector, symbol)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [s.name, s.type, s.qty, s.divQty, s.avgPrice,
         s.currentPrice, s.dividend, s.netDividend, s.sector, s.symbol]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function getDivs() {
  const { rows } = await pool.query(
    `SELECT id, year, month, "stockName", "grossDiv", tds, "netDiv", notes
     FROM dividends ORDER BY year, month`
  );
  return rows.map(rowToDiv);
}

async function setDivs(divs) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM dividends");
    for (const d of divs) {
      await client.query(
        `INSERT INTO dividends
           (id, year, month, "stockName", "grossDiv", tds, "netDiv", notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [d.id, d.year, d.month, d.stockName, d.grossDiv, d.tds, d.netDiv, d.notes]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function sanitise(body) {
  return {
    name:         String(body.name         ?? "").trim(),
    type:         String(body.type         ?? "Equity").trim(),
    qty:          Number(body.qty          ?? 0),
    divQty:       Number(body.divQty       ?? 0),
    avgPrice:     Number(body.avgPrice     ?? 0),
    currentPrice: Number(body.currentPrice ?? 0),
    dividend:     Number(body.dividend     ?? 0),
    netDividend:  Number(body.netDividend  ?? 0),
    sector:       String(body.sector       ?? "").trim(),
    symbol:       String(body.symbol       ?? "").trim().toUpperCase(),
  };
}

function sanitiseDiv(body) {
  return {
    id:        String(body.id        ?? String(Date.now())),
    year:      Number(body.year      ?? new Date().getFullYear()),
    month:     Number(body.month     ?? new Date().getMonth() + 1),
    stockName: String(body.stockName ?? "").trim(),
    grossDiv:  Number(body.grossDiv  ?? 0),
    tds:       Number(body.tds       ?? 0),
    netDiv:    Number(body.netDiv    ?? 0),
    notes:     String(body.notes     ?? "").trim(),
  };
}

// ── Express setup ─────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());
const rawExcel = express.raw({ type: "application/octet-stream", limit: "10mb" });

// ── Portfolio routes ──────────────────────────────────────────────────────────

app.get("/api/portfolio", async (_req, res) => {
  try { res.json(await getStocks()); }
  catch (err) { console.error(err); res.status(500).json({ error: "DB read failed" }); }
});

app.post("/api/portfolio", async (req, res) => {
  try {
    const stocks = await getStocks();
    stocks.push(sanitise(req.body));
    await setStocks(stocks);
    res.status(201).json(stocks);
  } catch (err) { console.error(err); res.status(500).json({ error: "Add stock failed" }); }
});

app.put("/api/portfolio", async (req, res) => {
  try {
    const stocks = (req.body ?? []).map(sanitise);
    await setStocks(stocks);
    res.json(stocks);
  } catch (err) { console.error(err); res.status(500).json({ error: "Bulk update failed" }); }
});

app.put("/api/portfolio/:index", async (req, res) => {
  try {
    const idx    = Number(req.params.index);
    const stocks = await getStocks();
    if (idx < 0 || idx >= stocks.length)
      return res.status(404).json({ error: "Stock not found" });
    stocks[idx] = sanitise(req.body);
    await setStocks(stocks);
    res.json(stocks);
  } catch (err) { console.error(err); res.status(500).json({ error: "Update stock failed" }); }
});

app.delete("/api/portfolio/:index", async (req, res) => {
  try {
    const idx    = Number(req.params.index);
    const stocks = await getStocks();
    if (idx < 0 || idx >= stocks.length)
      return res.status(404).json({ error: "Stock not found" });
    stocks.splice(idx, 1);
    await setStocks(stocks);
    res.json(stocks);
  } catch (err) { console.error(err); res.status(500).json({ error: "Delete stock failed" }); }
});

app.delete("/api/portfolio", async (_req, res) => {
  try { await pool.query("DELETE FROM portfolio"); res.json([]); }
  catch (err) { console.error(err); res.status(500).json({ error: "Clear failed" }); }
});

app.get("/api/portfolio/meta", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT COUNT(*) AS cnt FROM portfolio");
    res.json({
      rows:     Number(rows[0].cnt),
      modified: new Date().toISOString(),
      db:       "Neon PostgreSQL",
    });
  } catch (err) { console.error(err); res.status(500).json({ error: "Meta failed" }); }
});

// ── Dividend routes ───────────────────────────────────────────────────────────

app.get("/api/dividends", async (_req, res) => {
  try { res.json(await getDivs()); }
  catch (err) { console.error(err); res.status(500).json({ error: "DB read failed" }); }
});

app.post("/api/dividends", async (req, res) => {
  try {
    const entry = { ...sanitiseDiv(req.body), id: String(Date.now()) };
    const divs  = await getDivs();
    divs.push(entry);
    await setDivs(divs);
    res.status(201).json(divs);
  } catch (err) { console.error(err); res.status(500).json({ error: "Add dividend failed" }); }
});

app.put("/api/dividends/:id", async (req, res) => {
  try {
    const d = { ...sanitiseDiv(req.body), id: req.params.id };
    const result = await pool.query(
      `UPDATE dividends SET year=$1, month=$2, "stockName"=$3,
       "grossDiv"=$4, tds=$5, "netDiv"=$6, notes=$7 WHERE id=$8`,
      [d.year, d.month, d.stockName, d.grossDiv, d.tds, d.netDiv, d.notes, d.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Entry not found" });
    res.json(await getDivs());
  } catch (err) { console.error(err); res.status(500).json({ error: "Update dividend failed" }); }
});

app.delete("/api/dividends/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM dividends WHERE id=$1", [req.params.id]);
    res.json(await getDivs());
  } catch (err) { console.error(err); res.status(500).json({ error: "Delete dividend failed" }); }
});

// ── Combined tracker.xlsx — upload / download ─────────────────────────────────

const PORTFOLIO_COLS = ["name","type","qty","divQty","avgPrice","currentPrice","dividend","netDividend","sector"];
const DIV_COLS       = ["id","year","month","stockName","grossDiv","tds","netDiv","notes"];

function buildTrackerWorkbook(stocks, divs) {
  const wb  = XLSX.utils.book_new();
  const wsP = XLSX.utils.json_to_sheet(
    stocks.length ? stocks
      : [{ name:"",type:"Equity",qty:0,divQty:0,avgPrice:0,currentPrice:0,dividend:0,netDividend:0,sector:"" }],
    { header: PORTFOLIO_COLS }
  );
  XLSX.utils.book_append_sheet(wb, wsP, "Portfolio");
  const wsD = XLSX.utils.json_to_sheet(
    divs.length ? divs
      : [{ id:"",year:new Date().getFullYear(),month:1,stockName:"",grossDiv:0,tds:0,netDiv:0,notes:"" }],
    { header: DIV_COLS }
  );
  XLSX.utils.book_append_sheet(wb, wsD, "Dividends");
  return wb;
}

app.get("/api/tracker/download", async (_req, res) => {
  try {
    const stocks = await getStocks();
    const divs   = await getDivs();
    const buf    = XLSX.write(buildTrackerWorkbook(stocks, divs), { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", 'attachment; filename="tracker.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buf);
    console.log(`📥 tracker.xlsx downloaded — ${stocks.length} stocks, ${divs.length} div entries`);
  } catch (err) { console.error(err); res.status(500).json({ error: "Download failed" }); }
});

app.post("/api/tracker/upload", rawExcel, async (req, res) => {
  try {
    const wb  = XLSX.read(req.body, { type: "buffer" });
    const wsP = wb.Sheets["Portfolio"] ?? wb.Sheets[wb.SheetNames[0]];
    const stocks = XLSX.utils.sheet_to_json(wsP, { defval: "" })
      .map(sanitise).filter((s) => s.name);
    await setStocks(stocks);

    const wsD = wb.Sheets["Dividends"] ?? wb.Sheets[wb.SheetNames[1]];
    let divs  = [];
    if (wsD) {
      divs = XLSX.utils.sheet_to_json(wsD, { defval: "" }).map((r) => ({
        id:        String(r.id        || Date.now() + Math.random()),
        year:      Number(r.year      || new Date().getFullYear()),
        month:     Number(r.month     || 1),
        stockName: String(r.stockName || "").trim(),
        grossDiv:  Number(r.grossDiv  || 0),
        tds:       Number(r.tds       || 0),
        netDiv:    Number(r.netDiv    || 0),
        notes:     String(r.notes     || "").trim(),
      })).filter((r) => r.stockName);
      await setDivs(divs);
    }
    console.log(`📤 tracker.xlsx uploaded — ${stocks.length} stocks, ${divs.length} div entries`);
    res.json({ stocks, divs });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Failed to parse tracker.xlsx. Ensure it has 'Portfolio' and 'Dividends' sheets." });
  }
});

// ── Serve React frontend in production ────────────────────────────────────────

if (IS_PROD && existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get("/{*path}", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
  console.log("🌐 Serving React UI from dist/");
}

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, async () => {
  try {
    await initDB();
    console.log(`🚀 Portfolio Tracker → http://localhost:${PORT}`);
    console.log(`🗄️  Database : Neon PostgreSQL`);
    console.log(`🔧 Mode     : ${IS_PROD ? "production" : "development"}`);
  } catch (err) {
    console.error("❌ DB init failed:", err.message);
    process.exit(1);
  }
});
