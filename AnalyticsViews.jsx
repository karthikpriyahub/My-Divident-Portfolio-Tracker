import React, { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, TYPE_COLOR, calcStock, MONTH_NAMES, START_YEAR, YEARS } from "./utils.jsx";
import { Database, FileSpreadsheet, Table2, Download,
  AlertTriangle, RefreshCw, Trash2, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./utils.jsx";
import {
  Chart, BarElement, CategoryScale, LinearScale,
  Tooltip, Legend, BarController,
} from "chart.js";

Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, BarController);

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

  return (
    <>
      <div className="mb-6">
        <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-1">
          Portfolio Charts
        </h2>
        <p className="text-slate-400">Data labels shown on every bar — hover for full values.</p>
      </div>

      {/* Month-wise dividend — full width */}
      <div className="mb-6"><MonthlyDivChart /></div>

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

export function DataStoreView({ stocks, onRefresh, onClearAll, showToast }) {
  const [meta,        setMeta]        = useState(null);
  const [metaLoading, setMetaLoading] = useState(true);

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

  return (
    <>
      <div className="mb-8">
        <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
          Excel Data Store
        </h2>
        <p className="text-slate-400">All data lives in <code className="text-green-400">data/portfolio.xlsx</code> — your lightweight DB.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {metaLoading ? (
          <div className="col-span-4 flex items-center gap-3 text-slate-400 py-6">
            <Loader2 size={20} className="animate-spin" /> Loading…
          </div>
        ) : meta ? (
          <>
            <InfoCard icon={<FileSpreadsheet className="text-green-400"  size={22} />} label="Excel File"    value="portfolio.xlsx"      sub="Inside data/ folder"        color="green"  />
            <InfoCard icon={<Table2         className="text-blue-400"   size={22} />} label="Total Records" value={meta.rows}            sub="rows in spreadsheet"        color="blue"   />
            <InfoCard icon={<Database       className="text-purple-400" size={22} />} label="File Size"     value={`${meta.sizeKb} KB`} sub="on disk"                    color="purple" />
            <InfoCard icon={<RefreshCw      className="text-yellow-400" size={22} />} label="Last Modified" value={fmt(meta.modified)}   sub="auto-saved on every change" color="yellow" />
          </>
        ) : (
          <div className="col-span-4 text-red-400 flex items-center gap-2">
            <AlertTriangle size={18} /> Cannot reach API server.
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        <Button onClick={() => { window.open("/api/portfolio/download","_blank"); showToast("Downloading portfolio.xlsx…"); }}
          className="h-11 px-6 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-bold flex items-center gap-2">
          <Download size={16} /> Download portfolio.xlsx
        </Button>
        <Button onClick={async () => { await onRefresh(); await loadMeta(); showToast("Refreshed from Excel."); }}
          className="h-11 px-5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold flex items-center gap-2">
          <RefreshCw size={15} /> Refresh
        </Button>
        <Button onClick={onClearAll}
          className="h-11 px-5 rounded-2xl bg-red-500/20 hover:bg-red-500/40 text-red-300 font-semibold flex items-center gap-2 border border-red-500/30">
          <Trash2 size={15} /> Clear All Records
        </Button>
      </div>

      <Card className="bg-white/10 border-white/10 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Table2 size={16} className="text-cyan-400" /> Raw Excel Data Preview
            </h3>
            <span className="text-xs text-slate-400 bg-white/5 px-3 py-1 rounded-full">
              Portfolio · {stocks.length} rows
            </span>
          </div>
          {stocks.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <FileSpreadsheet size={36} className="mx-auto mb-3 opacity-30" /><p>No data yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-white">
                <thead className="bg-white/5 text-xs text-slate-400 uppercase tracking-wider">
                  <tr>{["Row","name","type","qty","avgPrice","currentPrice","dividend","netDividend","sector"]
                    .map((h) => <th key={h} className="p-4 text-left font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {stocks.map((s, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 font-mono text-xs">
                      <td className="p-4 text-slate-500">{i+1}</td>
                      <td className="p-4 text-green-400 font-bold">{s.name}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full border text-xs ${TYPE_COLOR[s.type] ?? TYPE_COLOR.Equity}`}>{s.type}</span>
                      </td>
                      <td className="p-4">{s.qty}</td>
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
