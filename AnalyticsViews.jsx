import React, { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, TYPE_COLOR, calcStock, MONTH_NAMES, START_YEAR, YEARS } from "./utils.jsx";
import { Database, FileSpreadsheet, Table2, Download,
  AlertTriangle, RefreshCw, Trash2, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./utils.jsx";
import {
  Chart, BarElement, CategoryScale, LinearScale,
  Tooltip, Legend, BarController,
  ArcElement, DoughnutController,
} from "chart.js";

Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, BarController,
               ArcElement, DoughnutController);

// ── Inline data-label plugin — draws ₹ value above every non-zero bar ────────

const dataLabelPlugin = {
  id: "dataLabels",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((dataset, di) => {
      const meta = chart.getDatasetMeta(di);
      if (meta.hidden) return;
      meta.data.forEach((bar, ji) => {
        const raw = dataset.data[ji];
        if (!raw) return;
        const abs  = Math.abs(raw);
        const label = abs >= 1000
          ? `₹${(abs / 1000).toFixed(1)}k`
          : `₹${Math.round(abs).toLocaleString()}`;
        ctx.save();
        ctx.font        = "bold 9px sans-serif";
        ctx.fillStyle   = "#e2e8f0";
        ctx.textAlign   = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(label, bar.x, bar.y - 3);
        ctx.restore();
      });
    });
  },
};

Chart.register(dataLabelPlugin);

// ── Shared chart options ──────────────────────────────────────────────────────

const CHART_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  layout: { padding: { top: 22 } },      // room for data labels
  plugins: {
    legend:       { labels: { color:"#cbd5e1", font:{ size:11 } } },
    dataLabels:   {},                     // enable our plugin
    tooltip: {
      backgroundColor:"#0f172a", borderColor:"#334155", borderWidth:1,
      titleColor:"#f1f5f9", bodyColor:"#94a3b8",
      callbacks: { label: (ctx) => ` ₹${Number(ctx.raw).toLocaleString()}` },
    },
  },
};

const BAR_AXIS = {
  grid:  { color:"#ffffff10" },
  ticks: { color:"#94a3b8", font:{ size:10 } },
};

// ── useChart hook ─────────────────────────────────────────────────────────────

function useChart(ref, type, data, options) {
  const instance = useRef(null);
  useEffect(() => {
    if (!ref.current || !data) return;
    instance.current?.destroy();
    instance.current = new Chart(ref.current, { type, data, options });
    return () => { instance.current?.destroy(); instance.current = null; };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ── Shared wrappers ───────────────────────────────────────────────────────────

function ChartCard({ title, children }) {
  return (
    <Card className="bg-white/10 border-white/10 backdrop-blur-xl rounded-3xl shadow-2xl">
      <CardContent className="p-6">
        <h3 className="text-lg font-bold text-white mb-5">{title}</h3>
        {children}
      </CardContent>
    </Card>
  );
}

function Bars({ labels, datasets, title, height = 300, tickFmt }) {
  const ref  = useRef(null);
  const data = { labels, datasets };
  const opts = {
    ...CHART_OPTS,
    scales: {
      x: { ...BAR_AXIS, ticks: { ...BAR_AXIS.ticks, maxRotation:35, minRotation:35 } },
      y: { ...BAR_AXIS, ticks: { ...BAR_AXIS.ticks, callback: tickFmt ?? ((v) => `₹${(v/1000).toFixed(0)}k`) } },
    },
  };
  useChart(ref, "bar", data, opts);
  return (
    <ChartCard title={title}>
      <div style={{ height, position:"relative" }}>
        <canvas ref={ref} />
      </div>
    </ChartCard>
  );
}

// ── Month-wise Dividend Chart ─────────────────────────────────────────────────

function MonthlyDivChart() {
  const [entries, setEntries] = useState([]);
  const [year,    setYear]    = useState(START_YEAR);
  const [loading, setLoading] = useState(true);
  const canvasRef  = useRef(null);
  const chartInst  = useRef(null);

  // fetch once on mount
  useEffect(() => {
    fetch("/api/dividends")
      .then((r) => r.json())
      .then((d) => setEntries(Array.isArray(d) ? d : []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  // rebuild chart whenever year or data changes
  useEffect(() => {
    if (!canvasRef.current) return;
    const yearData = entries.filter((e) => Number(e.year) === year);
    const agg = (field) => MONTH_NAMES.map((_, mi) =>
      yearData.filter((e) => Number(e.month) === mi + 1)
              .reduce((s, e) => s + Number(e[field] || 0), 0)
    );
    const gross = agg("grossDiv");
    const tds   = agg("tds");
    const net   = agg("netDiv");

    chartInst.current?.destroy();
    chartInst.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels: MONTH_NAMES,
        datasets: [
          { label:"Gross Div (₹)", data:gross, backgroundColor:"#fbbf2490", borderColor:"#fbbf24", borderWidth:1, borderRadius:5 },
          { label:"TDS (₹)",       data:tds,   backgroundColor:"#f8717190", borderColor:"#f87171", borderWidth:1, borderRadius:5 },
          { label:"Net Div (₹)",   data:net,   backgroundColor:"#34d39990", borderColor:"#34d399", borderWidth:1, borderRadius:5 },
        ],
      },
      options: {
        ...CHART_OPTS,
        scales: {
          x: { ...BAR_AXIS },
          y: { ...BAR_AXIS, ticks:{ ...BAR_AXIS.ticks, callback:(v) => `₹${(v/1000).toFixed(0)}k` } },
        },
      },
    });
    return () => { chartInst.current?.destroy(); chartInst.current = null; };
  }, [entries, year]);

  const yearData    = entries.filter((e) => Number(e.year) === year);
  const annualGross = yearData.reduce((s,e) => s+Number(e.grossDiv||0), 0);
  const annualTds   = yearData.reduce((s,e) => s+Number(e.tds||0),      0);
  const annualNet   = yearData.reduce((s,e) => s+Number(e.netDiv||0),   0);
  const hasData     = annualGross > 0;

  return (
    <ChartCard title={`📅 Month-wise Dividend Amount — ${year}`}>
      {/* Year picker + summary */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button onClick={() => setYear((y) => Math.max(START_YEAR, y - 1))}
          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition">
          <ChevronLeft size={15} />
        </button>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}
          className="bg-slate-900 border border-slate-700 text-white font-bold px-3 py-1.5 rounded-xl text-sm">
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={() => setYear((y) => Math.min(START_YEAR + 14, y + 1))}
          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition">
          <ChevronRight size={15} />
        </button>
        {loading && <Loader2 size={15} className="animate-spin text-slate-400" />}
        {hasData && (
          <div className="ml-auto flex gap-4">
            {[
              { label:"Gross", value:annualGross, col:"text-yellow-400" },
              { label:"TDS",   value:annualTds,   col:"text-red-400"    },
              { label:"Net",   value:annualNet,   col:"text-green-400"  },
            ].map(({ label, value, col }) => (
              <span key={label} className="text-xs">
                <span className="text-slate-400">{label} </span>
                <span className={`font-bold ${col}`}>₹{Math.round(value).toLocaleString()}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 text-slate-400" style={{ height:300 }}>
          <Loader2 size={20} className="animate-spin" /> Loading…
        </div>
      ) : !hasData ? (
        <div className="flex flex-col items-center justify-center" style={{ height:300 }}>
          <p className="text-3xl mb-3">📋</p>
          <p className="text-slate-400 font-semibold">No dividends logged for {year}</p>
          <p className="text-sm text-slate-500 mt-1">Add entries in the <strong className="text-yellow-400">Div Tracker</strong> tab first</p>
        </div>
      ) : (
        <div style={{ height:300, position:"relative" }}>
          <canvas ref={canvasRef} />
        </div>
      )}
    </ChartCard>
  );
}

function Doughnut({ data, options }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const ch = new Chart(ref.current, { type: "doughnut", data, options });
    return () => ch.destroy();
  }, [JSON.stringify(data)]);
  return <canvas ref={ref} />;
}

// ══════════════════════════════════════════════════════════════════════════════
// Charts View
// ══════════════════════════════════════════════════════════════════════════════

export function ChartsView({ stocks }) {
  const computed = stocks.map(calcStock);

  if (stocks.length === 0) return (
    <div className="text-center py-24 text-slate-500">
      <p className="text-5xl mb-4">📊</p>
      <p className="text-white font-semibold">No data to chart yet.</p>
    </div>
  );

  // P&L per stock
  const shortLabels = computed.map((s) => s.name.split(" ")[0]);
  const pnlValues   = computed.map((s) => Math.round(s.pnl));
  const pnlColors   = pnlValues.map((v) => v >= 0 ? "#4ade8090" : "#f8717190");
  const pnlBorders  = pnlValues.map((v) => v >= 0 ? "#4ade80"   : "#f87171"  );

  // Gross vs Net Div
  const divStocks = computed.filter((s) => s.gross > 0);
  const divLabels = divStocks.map((s) => s.name.split(" ")[0]);

  // Sector allocation
  const sectorMap = {};
  computed.forEach((s) => {
    const sec = s.sector || "Other";
    sectorMap[sec] = (sectorMap[sec] || 0) + s.inv;
  });
  const secLabels = Object.keys(sectorMap);
  const secValues = secLabels.map((k) => Math.round(sectorMap[k]));
  const PALETTE   = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6",
                     "#06b6d4","#f97316","#84cc16","#ec4899","#6366f1"];

  return (
    <>
      <div className="mb-6">
        <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-1">
          Portfolio Charts
        </h2>
        <p className="text-slate-400">Data labels shown on every bar — hover for full values.</p>
      </div>

      {/* Sector Allocation Doughnut */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-white/10 border-white/10 backdrop-blur-xl rounded-3xl shadow-2xl">
          <CardContent className="p-5">
            <p className="text-white font-bold mb-4">🎯 Sector-wise Allocation</p>
            <div style={{ position:"relative", height:260 }}>
              <Doughnut
                data={{
                  labels: secLabels,
                  datasets: [{ data: secValues,
                    backgroundColor: PALETTE.slice(0, secLabels.length),
                    borderColor: "#0f172a", borderWidth: 2 }],
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: {
                    legend: { position:"right", labels:{ color:"#cbd5e1", boxWidth:12, padding:10 } },
                    tooltip: {
                      callbacks: {
                        label: (ctx) => ` ₹${ctx.parsed.toLocaleString("en-IN")} (${((ctx.parsed/secValues.reduce((a,b)=>a+b,0))*100).toFixed(1)}%)`
                      }
                    }
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Sector table */}
        <Card className="bg-white/10 border-white/10 backdrop-blur-xl rounded-3xl shadow-2xl">
          <CardContent className="p-5">
            <p className="text-white font-bold mb-4">📊 Sector Breakdown</p>
            <div className="space-y-3">
              {secLabels.map((sec, i) => {
                const total = secValues.reduce((a, b) => a + b, 0);
                const pct   = total ? ((secValues[i] / total) * 100).toFixed(1) : 0;
                return (
                  <div key={sec}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300 font-semibold">{sec}</span>
                      <span className="text-white">₹{secValues[i].toLocaleString("en-IN")} · {pct}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div style={{ width:`${pct}%`, background: PALETTE[i % PALETTE.length] }}
                        className="h-full rounded-full transition-all" />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* P&L */}
      <div className="mb-6">
        <Bars
          title="📈 Stock P&L (₹) — Green = Profit · Red = Loss"
          labels={shortLabels}
          datasets={[{
            label:"P&L (₹)", data:pnlValues,
            backgroundColor:pnlColors, borderColor:pnlBorders, borderWidth:1, borderRadius:6,
          }]}
          height={300}
        />
      </div>

      {/* Gross vs Net */}
      <Bars
        title="💰 Gross vs Net Dividend per Stock (₹)"
        labels={divLabels}
        datasets={[
          { label:"Gross Div (₹)", data:divStocks.map((s) => Math.round(s.gross)), backgroundColor:"#fbbf2490", borderColor:"#fbbf24", borderWidth:1, borderRadius:4 },
          { label:"Net Div (₹)",   data:divStocks.map((s) => Math.round(s.net)),   backgroundColor:"#34d39990", borderColor:"#34d399", borderWidth:1, borderRadius:4 },
        ]}
        height={300}
      />
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Data Store View
// ══════════════════════════════════════════════════════════════════════════════

const C = { green:"text-green-400", blue:"text-blue-400", purple:"text-purple-400", yellow:"text-yellow-400" };

function InfoCard({ icon, label, value, sub, color }) {
  return (
    <Card className="bg-white/10 border-white/10 backdrop-blur-xl rounded-2xl">
      <CardContent className="p-5">
        <div className="flex items-center gap-3 mb-3">
          {icon}
          <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">{label}</span>
        </div>
        <p className={`text-2xl font-bold ${C[color] ?? "text-white"}`}>{value}</p>
        <p className="text-xs text-slate-500 mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

export function DataStoreView({ stocks, onRefresh, onStocksChange, onRefreshAll, onClearAll, showToast }) {
  const [meta,        setMeta]        = useState(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [uploading,   setUploading]   = useState(false);
  const fileRef = useRef(null);

  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    try   { setMeta(await fetch("/api/portfolio/meta").then((r) => r.json())); }
    catch { setMeta(null); }
    finally { setMetaLoading(false); }
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  const fmt = (iso) => iso
    ? new Date(iso).toLocaleString("en-IN", { dateStyle:"medium", timeStyle:"short" })
    : "—";


  // ── Combined tracker.xlsx upload handler ─────────────────────────────────────

  const handleUpload = async (file) => {
    if (!file) return;
    if (!file.name.match(/\.xlsx$/i)) {
      showToast("⚠️ Please upload a .xlsx file only.", false); return;
    }
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const res = await fetch("/api/tracker/upload", {
        method:  "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body:    buf,
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error || "Upload failed.", false);
        return;
      }
      const { rows, count } = await res.json();
      if (onRefreshAll) await onRefreshAll();
      await loadMeta();
      showToast(`✅ Neon synced — ${count} rows loaded into tracker table!`);
    } catch {
      showToast("Upload failed. Make sure it's a valid tracker.xlsx file.", false);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    handleUpload(e.dataTransfer.files[0]);
  };

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent mb-2">
          Excel Data Store
        </h2>
        <p className="text-slate-400 text-sm">
          One Excel file — Portfolio + Dividends. Upload once → syncs both Neon tables instantly.
        </p>
      </div>

      {/* Step 1 — Download template */}
      <Card className="bg-white/10 border-white/10 backdrop-blur-xl rounded-3xl shadow-2xl mb-5">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 text-emerald-400 font-black text-sm">1</div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-white mb-1">Download the Template</h3>
              <p className="text-xs text-slate-400 mb-4">
                Get a pre-filled Excel with 3 sheets: <span className="text-white font-semibold">Instructions</span>,
                <span className="text-emerald-400 font-mono"> Portfolio</span> and
                <span className="text-blue-400 font-mono"> Dividends</span>.
                Fill in your real data, delete sample rows, save and upload below.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => { window.open("/api/tracker/template","_blank"); showToast("📥 Downloading DivTracker_Template.xlsx…"); }}
                  className="h-10 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold flex items-center gap-2 text-sm">
                  <Download size={15} /> Download Template
                </Button>
                <Button
                  onClick={() => { window.open("/api/tracker/download","_blank"); showToast("📥 Exporting current data…"); }}
                  className="h-10 px-5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold flex items-center gap-2 text-sm">
                  <Download size={15} /> Export Current Data
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 2 — Upload & sync */}
      <Card className="bg-white/10 border-white/10 backdrop-blur-xl rounded-3xl shadow-2xl mb-5">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center shrink-0 text-blue-400 font-black text-sm">2</div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-white mb-1">Upload &amp; Sync All Data to Neon</h3>
              <p className="text-xs text-slate-400 mb-4">
                Upload your filled <span className="text-emerald-400 font-mono">.xlsx</span> — both
                <span className="text-white font-semibold"> Portfolio</span> and
                <span className="text-white font-semibold"> Dividends</span> tables get replaced in
                Neon PostgreSQL. Every tab in the app refreshes automatically.
              </p>
              {/* Drop zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-blue-500/40 hover:border-blue-400 rounded-2xl p-10 text-center cursor-pointer transition-all hover:bg-white/5 mb-4"
              >
                <input ref={fileRef} type="file" accept=".xlsx" className="hidden"
                  onChange={(e) => handleUpload(e.target.files[0])} />
                {uploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 size={36} className="animate-spin text-blue-400" />
                    <p className="text-slate-300 font-semibold">Syncing to Neon…</p>
                    <p className="text-slate-500 text-xs">Updating Portfolio + Dividends tables</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-4 rounded-full bg-blue-500/15">
                      <FileSpreadsheet size={36} className="text-blue-400" />
                    </div>
                    <p className="text-white font-bold text-base">Drag &amp; drop your .xlsx here</p>
                    <p className="text-slate-400 text-sm">or click to browse</p>
                    <div className="flex gap-2 flex-wrap justify-center">
                      <span className="text-emerald-400 font-mono text-xs bg-emerald-500/10 px-3 py-1 rounded-full">Sheet: Portfolio</span>
                      <span className="text-blue-400 font-mono text-xs bg-blue-500/10 px-3 py-1 rounded-full">Sheet: Dividends</span>
                    </div>
                  </div>
                )}
              </div>
              {/* Column guide */}
              <details>
                <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 transition">
                  📋 13 columns — click to expand
                </summary>
                <div className="mt-3 bg-slate-900/60 rounded-xl p-4">
                  <p className="text-xs text-emerald-400 font-bold mb-3">Tracker sheet — all in one</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    {[
                      ["stockName",    "Stock / fund name"],
                      ["type",         "Equity / ETF / MutualFund"],
                      ["sector",       "IT / Banking / FMCG…"],
                      ["symbol",       "NSE ticker (e.g. INFY)"],
                      ["qty",          "Units / shares held"],
                      ["avgPrice",     "Avg buy price ₹"],
                      ["currentPrice", "Current market price ₹"],
                      ["year",         "4-digit year (2025)"],
                      ["month",        "Month number 1–12"],
                      ["grossDiv",     "Gross dividend ₹"],
                      ["tds",          "TDS deducted ₹"],
                      ["netDiv",       "Net received ₹"],
                      ["notes",        "Optional note"],
                    ].map(([col, desc]) => (
                      <div key={col} className="flex items-baseline gap-2">
                        <code className="text-[10px] text-blue-300 font-mono shrink-0 w-28">{col}</code>
                        <span className="text-[10px] text-slate-400">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 3 — Quick actions */}
      <Card className="bg-white/10 border-white/10 backdrop-blur-xl rounded-3xl shadow-2xl mb-6">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center shrink-0 text-violet-400 font-black text-sm">3</div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-white mb-1">Quick Actions</h3>
              <p className="text-xs text-slate-400 mb-4">Force-refresh all tabs from Neon or check record counts.</p>
              <div className="flex flex-wrap gap-3 items-center">
                <Button
                  onClick={async () => { if (onRefreshAll) await onRefreshAll(); await loadMeta(); showToast("🔄 All tabs refreshed from Neon!"); }}
                  className="h-10 px-5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-bold flex items-center gap-2 text-sm">
                  <RefreshCw size={15} /> Refresh All Tabs
                </Button>
                {meta && (
                  <span className="text-xs text-slate-400">
                    Neon: <span className="text-white font-bold">{meta.rows}</span> portfolio rows
                  </span>
                )}
                {metaLoading && <Loader2 size={16} className="animate-spin text-slate-400" />}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Raw preview */}
      <Card className="bg-white/10 border-white/10 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Table2 size={16} className="text-cyan-400" /> Portfolio Data Preview
            </h3>
            <span className="text-xs text-slate-400 bg-white/5 px-3 py-1 rounded-full">
              {stocks.length} row{stocks.length !== 1 ? "s" : ""}
            </span>
          </div>
          {stocks.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <FileSpreadsheet size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold">No data yet</p>
              <p className="text-xs mt-1">Upload tracker.xlsx above to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-white">
                <thead className="bg-white/5 text-xs text-slate-400 uppercase tracking-wider">
                  <tr>{["Row","name","type","qty","divQty","avgPrice","currentPrice","dividend","netDividend","sector"]
                    .map((h) => <th key={h} className="p-4 text-left font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {stocks.map((s, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 font-mono text-xs">
                      <td className="p-4 text-slate-500">{i+1}</td>
                      <td className="p-4 text-green-400 font-bold">{s.name}</td>
                      <td className="p-4"><span className={`px-2 py-0.5 rounded-full border text-xs ${TYPE_COLOR[s.type] ?? TYPE_COLOR.Equity}`}>{s.type}</span></td>
                      <td className="p-4">{s.qty}</td>
                      <td className="p-4 text-cyan-300">{s.divQty || "—"}</td>
                      <td className="p-4">{s.avgPrice}</td>
                      <td className="p-4">{s.currentPrice}</td>
                      <td className="p-4">{s.dividend}</td>
                      <td className="p-4 text-emerald-300">{s.netDividend}</td>
                      <td className="p-4 text-slate-400">{s.sector}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
