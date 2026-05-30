/**
 * DivTracker — Express backend
 * ONE table  : tracker  (stocks + dividends combined)
 * ONE sheet  : Tracker  (dropdown + VLOOKUP auto-fill + server-side merge)
 * Excel gen  : openpyxl via gen_template.py (clean, no corruption)
 * Database   : Neon PostgreSQL
 */

import "dotenv/config";
import express   from "express";
import cors      from "cors";
import XLSX      from "xlsx";           // used only for upload parsing
import pkg       from "pg";
import { existsSync, writeFileSync, readFileSync } from "fs";
import { execFileSync }  from "child_process";
import { fileURLToPath } from "url";
import { tmpdir }        from "os";
import path from "path";

const { Pool } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT     = process.env.PORT    || 3001;
const DIST_DIR = path.join(__dirname, "dist");
const IS_PROD  = process.env.NODE_ENV === "production";
const APP_PIN  = process.env.APP_PIN  || "Karthik@2025";
const GEN_PY   = path.join(__dirname, "gen_template.py");

// ── Neon pool ─────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString:      process.env.DATABASE_URL,
  ssl:                   { rejectUnauthorized: false },
  max:                   5,
  connectionTimeoutMillis: 8000,
  idleTimeoutMillis:       30000,
  query_timeout:           8000,
});

// ── DB init ───────────────────────────────────────────────────────────────────
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tracker (
      id             SERIAL  PRIMARY KEY,
      "stockName"    TEXT    NOT NULL DEFAULT '',
      type           TEXT    NOT NULL DEFAULT 'Equity',
      sector         TEXT    NOT NULL DEFAULT '',
      symbol         TEXT    NOT NULL DEFAULT '',
      qty            NUMERIC NOT NULL DEFAULT 0,
      "avgPrice"     NUMERIC NOT NULL DEFAULT 0,
      "currentPrice" NUMERIC NOT NULL DEFAULT 0,
      yr             INTEGER NOT NULL DEFAULT 0,
      mo             INTEGER NOT NULL DEFAULT 0,
      "grossDiv"     NUMERIC NOT NULL DEFAULT 0,
      tds            NUMERIC NOT NULL DEFAULT 0,
      "netDiv"       NUMERIC NOT NULL DEFAULT 0,
      notes          TEXT    NOT NULL DEFAULT ''
    )
  `);
  for (const sql of [
    `ALTER TABLE tracker ADD COLUMN IF NOT EXISTS yr      INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE tracker ADD COLUMN IF NOT EXISTS mo      INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE tracker ADD COLUMN IF NOT EXISTS symbol  TEXT    NOT NULL DEFAULT ''`,
    `ALTER TABLE tracker ADD COLUMN IF NOT EXISTS sector  TEXT    NOT NULL DEFAULT ''`,
  ]) { try { await pool.query(sql); } catch (_) {} }
  console.log("🗄️  Neon DB — tracker table ready");
}

// ── Row helpers ───────────────────────────────────────────────────────────────
function mapRow(r) {
  return {
    id:           Number(r.id),
    stockName:    String(r.stockName    ?? "").trim(),
    type:         String(r.type         ?? "Equity").trim(),
    sector:       String(r.sector       ?? "").trim(),
    symbol:       String(r.symbol       ?? "").trim(),
    qty:          Number(r.qty          ?? 0),
    avgPrice:     Number(r.avgPrice     ?? 0),
    currentPrice: Number(r.currentPrice ?? 0),
    year:         Number(r.yr           ?? 0),
    month:        Number(r.mo           ?? 0),
    grossDiv:     Number(r.grossDiv     ?? 0),
    tds:          Number(r.tds          ?? 0),
    netDiv:       Number(r.netDiv       ?? 0),
    notes:        String(r.notes        ?? "").trim(),
  };
}

function sanitiseRow(r) {
  return {
    stockName:    String(r.stockName    ?? "").trim(),
    type:         String(r.type         ?? "Equity").trim(),
    sector:       String(r.sector       ?? "").trim(),
    symbol:       String(r.symbol       ?? "").trim().toUpperCase(),
    qty:          Number(r.qty)          || 0,
    avgPrice:     Number(r.avgPrice)     || 0,
    currentPrice: Number(r.currentPrice) || 0,
    yr:           Number(r.year)         || new Date().getFullYear(),
    mo:           Number(r.month)        || 1,
    grossDiv:     Number(r.grossDiv)     || 0,
    tds:          Number(r.tds)          || 0,
    netDiv:       Number(r.netDiv)       || 0,
    notes:        String(r.notes        ?? "").trim(),
  };
}

// ── Merge rows: same stockName + year + month → sum dividends ─────────────────
function mergeRows(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = `${r.stockName.toLowerCase()}|${r.yr}|${r.mo}`;
    if (!map.has(key)) {
      map.set(key, { ...r });
    } else {
      const ex = map.get(key);
      ex.grossDiv += r.grossDiv;
      ex.tds      += r.tds;
      ex.netDiv   += r.netDiv;
      if (r.qty          > 0) ex.qty          = r.qty;
      if (r.avgPrice     > 0) ex.avgPrice      = r.avgPrice;
      if (r.currentPrice > 0) ex.currentPrice  = r.currentPrice;
      if (r.type)             ex.type          = r.type;
      if (r.sector)           ex.sector        = r.sector;
      if (r.symbol)           ex.symbol        = r.symbol;
      if (r.notes && r.notes !== ex.notes)
        ex.notes = ex.notes ? `${ex.notes}; ${r.notes}` : r.notes;
    }
  }
  return [...map.values()];
}

// ── DB helpers ────────────────────────────────────────────────────────────────
async function getAll() {
  const { rows } = await pool.query(
    `SELECT * FROM tracker ORDER BY "stockName", yr, mo`
  );
  return rows.map(mapRow);
}

async function replaceAll(rows) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM tracker");
    for (const r of rows) {
      await client.query(
        `INSERT INTO tracker
           ("stockName",type,sector,symbol,qty,"avgPrice","currentPrice",
            yr,mo,"grossDiv",tds,"netDiv",notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [r.stockName, r.type, r.sector, r.symbol,
         r.qty, r.avgPrice, r.currentPrice,
         r.yr, r.mo, r.grossDiv, r.tds, r.netDiv, r.notes]
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

// ── Derived views (legacy tab compatibility) ──────────────────────────────────
function derivePortfolio(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.stockName.toLowerCase();
    if (!map.has(key)) {
      map.set(key, { ...r });
    } else {
      const ex = map.get(key);
      if (r.currentPrice > 0) ex.currentPrice = r.currentPrice;
      if (r.qty          > 0) ex.qty           = r.qty;
      if (r.avgPrice     > 0) ex.avgPrice       = r.avgPrice;
    }
  }
  return [...map.values()].map(r => ({
    name: r.stockName, type: r.type, qty: r.qty, divQty: r.qty,
    avgPrice: r.avgPrice, currentPrice: r.currentPrice,
    dividend: r.grossDiv, netDividend: r.netDiv,
    sector: r.sector, symbol: r.symbol,
  }));
}

function deriveDividends(rows) {
  return rows
    .filter(r => r.grossDiv > 0 || r.netDiv > 0)
    .map((r, i) => ({
      id: String(r.id || i), year: r.year, month: r.month,
      stockName: r.stockName, grossDiv: r.grossDiv,
      tds: r.tds, netDiv: r.netDiv, notes: r.notes,
    }));
}

// ── Fallback stocks (used when DB is empty / unreachable) ─────────────────────
const FALLBACK_STOCKS = [
  // Equity
  { stockName:"Coal India Ltd",                  type:"Equity", sector:"Energy",         symbol:"COALINDIA"    },
  { stockName:"HCL Technologies Ltd",            type:"Equity", sector:"IT",             symbol:"HCLTECH"      },
  { stockName:"ITC Limited",                     type:"Equity", sector:"FMCG",           symbol:"ITC"          },
  { stockName:"Power Finance Corp",              type:"Equity", sector:"Finance",        symbol:"PFC"          },
  { stockName:"REC Limited",                     type:"Equity", sector:"Finance",        symbol:"RECLTD"       },
  { stockName:"Castrol India Ltd",               type:"Equity", sector:"Energy",         symbol:"CASTROLIND"   },
  { stockName:"Vedanta Limited",                 type:"Equity", sector:"Metals",         symbol:"VEDL"         },
  // REITs
  { stockName:"Nexus Select Trust",              type:"REIT",   sector:"Real Estate",    symbol:"NEXUSSELECT"  },
  { stockName:"Mindspace Business Parks",        type:"REIT",   sector:"Real Estate",    symbol:"MINDSPACE"    },
  { stockName:"Brookfield India REIT",           type:"REIT",   sector:"Real Estate",    symbol:"BIRET"        },
  { stockName:"Embassy Office Parks",            type:"REIT",   sector:"Real Estate",    symbol:"EMBASSYOFFICE"},
  // InvITs
  { stockName:"Bharat Highways InvIT",           type:"InvIT",  sector:"Infrastructure", symbol:"BHARATHWY"    },
  { stockName:"IRB InvIT Fund",                  type:"InvIT",  sector:"Infrastructure", symbol:"IRBINVIT"     },
  { stockName:"India Grid Trust",                type:"InvIT",  sector:"Infrastructure", symbol:"INDIGRID"     },
  { stockName:"PowerGrid Infra Invest",          type:"InvIT",  sector:"Infrastructure", symbol:"PGCIL"        },
];

// ── Build xlsx via openpyxl (clean, no corruption) ────────────────────────────
function buildXlsx(stocks, rows = []) {
  const tmp = path.join(tmpdir(), `dvt_${Date.now()}.xlsx`);
  const stocksJ = JSON.stringify(stocks.map(s => ({
    stockName: s.stockName ?? s.name ?? "",
    type:      s.type      ?? "Equity",
    sector:    s.sector    ?? "",
    symbol:    s.symbol    ?? "",
  })));
  const rowsJ = JSON.stringify(rows);
  try {
    execFileSync("python3", [GEN_PY, stocksJ, rowsJ, tmp]);
    return readFileSync(tmp);
  } finally {
    try { execFileSync("rm", ["-f", tmp]); } catch (_) {}
  }
}

// ── Express ───────────────────────────────────────────────────────────────────
const app      = express();
const rawExcel = express.raw({ type:"application/octet-stream", limit:"10mb" });
app.use(cors());
app.use(express.json());

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post("/api/auth", (req, res) => {
  const { pin } = req.body || {};
  if (pin === APP_PIN) return res.json({ ok: true });
  res.status(401).json({ ok: false, error: "Wrong password" });
});

// ── Tracker CRUD ──────────────────────────────────────────────────────────────
app.get("/api/tracker", async (_req, res) => {
  try { res.json(await getAll()); }
  catch (err) { console.error(err); res.status(500).json({ error: "DB read failed" }); }
});

app.post("/api/tracker", async (req, res) => {
  try {
    const r = sanitiseRow(req.body);
    await pool.query(
      `INSERT INTO tracker
         ("stockName",type,sector,symbol,qty,"avgPrice","currentPrice",
          yr,mo,"grossDiv",tds,"netDiv",notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [r.stockName,r.type,r.sector,r.symbol,r.qty,r.avgPrice,r.currentPrice,
       r.yr,r.mo,r.grossDiv,r.tds,r.netDiv,r.notes]
    );
    res.status(201).json(await getAll());
  } catch (err) { console.error(err); res.status(500).json({ error: "Insert failed" }); }
});

app.put("/api/tracker/:id", async (req, res) => {
  try {
    const r = sanitiseRow(req.body);
    await pool.query(
      `UPDATE tracker SET "stockName"=$1,type=$2,sector=$3,symbol=$4,
       qty=$5,"avgPrice"=$6,"currentPrice"=$7,yr=$8,mo=$9,
       "grossDiv"=$10,tds=$11,"netDiv"=$12,notes=$13 WHERE id=$14`,
      [r.stockName,r.type,r.sector,r.symbol,r.qty,r.avgPrice,r.currentPrice,
       r.yr,r.mo,r.grossDiv,r.tds,r.netDiv,r.notes,Number(req.params.id)]
    );
    res.json(await getAll());
  } catch (err) { console.error(err); res.status(500).json({ error: "Update failed" }); }
});

app.delete("/api/tracker/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM tracker WHERE id=$1",[Number(req.params.id)]);
    res.json(await getAll());
  } catch (err) { console.error(err); res.status(500).json({ error: "Delete failed" }); }
});

// ── Legacy endpoints (existing UI tabs) ───────────────────────────────────────
app.get("/api/portfolio", async (_req, res) => {
  try { res.json(derivePortfolio(await getAll())); }
  catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.get("/api/dividends", async (_req, res) => {
  try { res.json(deriveDividends(await getAll())); }
  catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.post("/api/dividends", async (req, res) => {
  try {
    const b = req.body || {};
    const r = sanitiseRow({
      stockName:b.stockName, type:"", sector:"", symbol:"",
      qty:0, avgPrice:0, currentPrice:0,
      year:b.year, month:b.month,
      grossDiv:b.grossDiv, tds:b.tds, netDiv:b.netDiv, notes:b.notes,
    });
    await pool.query(
      `INSERT INTO tracker ("stockName",type,sector,symbol,qty,"avgPrice","currentPrice",
         yr,mo,"grossDiv",tds,"netDiv",notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [r.stockName,r.type,r.sector,r.symbol,r.qty,r.avgPrice,r.currentPrice,
       r.yr,r.mo,r.grossDiv,r.tds,r.netDiv,r.notes]
    );
    res.status(201).json(deriveDividends(await getAll()));
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.put("/api/dividends/:id", async (req, res) => {
  try {
    const b = req.body || {};
    await pool.query(
      `UPDATE tracker SET "stockName"=$1,yr=$2,mo=$3,
       "grossDiv"=$4,tds=$5,"netDiv"=$6,notes=$7 WHERE id=$8`,
      [b.stockName,b.year||0,b.month||0,
       b.grossDiv||0,b.tds||0,b.netDiv||0,b.notes||"",Number(req.params.id)]
    );
    res.json(deriveDividends(await getAll()));
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.delete("/api/dividends/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM tracker WHERE id=$1",[Number(req.params.id)]);
    res.json(deriveDividends(await getAll()));
  } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.get("/api/portfolio/meta", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT COUNT(*) AS cnt FROM tracker");
    res.json({ rows:Number(rows[0].cnt), modified:new Date().toISOString(), db:"Neon PostgreSQL" });
  } catch (err) { res.status(500).json({ error: "Meta failed" }); }
});

// ── Excel: template ───────────────────────────────────────────────────────────
app.get("/api/tracker/template", async (_req, res) => {
  try {
    let stocks = FALLBACK_STOCKS;
    try {
      const timeout = new Promise((_, rej) => setTimeout(() => rej(), 4000));
      const { rows } = await Promise.race([
        pool.query(`SELECT DISTINCT "stockName",type,sector,symbol FROM tracker ORDER BY "stockName"`),
        timeout,
      ]);
      if (rows.length) stocks = rows;
    } catch (_) {}

    const buf = buildXlsx(stocks, []);
    res.setHeader("Content-Disposition", 'attachment; filename="DivTracker_Template.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buf);
  } catch (err) { console.error(err); res.status(500).json({ error:"Template build failed" }); }
});

// ── Excel: export current data ────────────────────────────────────────────────
app.get("/api/tracker/download", async (_req, res) => {
  try {
    const all    = await getAll();
    const stocks = [...new Map(all.map(r =>
      [r.stockName.toLowerCase(), { stockName:r.stockName, type:r.type, sector:r.sector, symbol:r.symbol }]
    )).values()];
    const buf = buildXlsx(stocks, all);
    res.setHeader("Content-Disposition", 'attachment; filename="DivTracker_Export.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buf);
    console.log(`📥 DivTracker_Export.xlsx — ${all.length} rows`);
  } catch (err) { console.error(err); res.status(500).json({ error:"Export failed" }); }
});

// ── Excel: upload → merge → replace Neon ─────────────────────────────────────
app.post("/api/tracker/upload", rawExcel, async (req, res) => {
  try {
    const wb = XLSX.read(req.body, { type:"buffer" });
    const ws = wb.Sheets["Tracker"] ?? wb.Sheets[wb.SheetNames[0]];
    if (!ws) return res.status(400).json({ error:"No Tracker sheet found." });

    const raw = XLSX.utils.sheet_to_json(ws, { defval:"" })
      .map(sanitiseRow)
      .filter(r => r.stockName);

    const merged = mergeRows(raw);
    await replaceAll(merged);
    const saved = await getAll();
    console.log(`📤 Uploaded — ${raw.length} raw → ${merged.length} merged → Neon`);
    res.json({ rows: saved, count: saved.length, merged: merged.length, raw: raw.length });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error:"Parse failed. Check column headers match the template." });
  }
});

// ── Serve React in production ─────────────────────────────────────────────────
if (IS_PROD && existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get("/{*path}", (_req, res) => {
    res.set("Cache-Control","no-store");
    res.sendFile(path.join(DIST_DIR,"index.html"));
  });
}

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`🚀 DivTracker → http://localhost:${PORT}`);
  try {
    await initDB();
  } catch (err) {
    console.warn("⚠️  Neon unreachable at startup — server still running.");
    console.warn("   DB routes retry on each request. Check VPN / Neon dashboard.");
  }
});
