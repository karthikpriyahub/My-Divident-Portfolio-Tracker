import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "./utils.jsx";
import { Loader2, ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { MONTH_NAMES } from "./utils.jsx";

// ── constants ─────────────────────────────────────────────────────────────────

const START_YEAR = new Date().getFullYear();
const YEARS      = Array.from({ length: 15 }, (_, i) => START_YEAR + i);

// ── CalendarView ──────────────────────────────────────────────────────────────

export default function CalendarView({ refreshKey = 0 }) {
  const [entries,  setEntries]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [year,     setYear]     = useState(START_YEAR);

  // ── fetch from dividends.xlsx via API ─────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch("/api/dividends").then((r) => r.json());
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  // ── derive monthly data for selected year ────────────────────────────────

  const yearEntries = entries.filter((e) => Number(e.year) === year);

  // byMonth[0] = January entries, byMonth[11] = December entries
  const byMonth = MONTH_NAMES.map((_, mi) =>
    yearEntries.filter((e) => Number(e.month) === mi + 1)
  );

  const monthNet   = byMonth.map((es) => es.reduce((s, e) => s + Number(e.netDiv   || 0), 0));
  const monthGross = byMonth.map((es) => es.reduce((s, e) => s + Number(e.grossDiv || 0), 0));
  const monthTds   = byMonth.map((es) => es.reduce((s, e) => s + Number(e.tds      || 0), 0));

  const annualNet   = monthNet.reduce((a, b) => a + b, 0);
  const annualGross = monthGross.reduce((a, b) => a + b, 0);
  const annualTds   = monthTds.reduce((a, b) => a + b, 0);
  const monthlyAvg  = annualNet > 0 ? Math.round(annualNet / 12) : 0;
  const peakIdx     = monthNet.indexOf(Math.max(...monthNet));
  const maxBar      = Math.max(...monthNet, 1);

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Header + year picker */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent mb-1">
            Dividend Calendar
          </h2>
          <p className="text-slate-400 text-sm flex items-center gap-1.5">
            <BookOpen size={13} className="text-yellow-400" />
            Live data from your <strong className="text-yellow-400">Div Tracker</strong> entries ·
            log a dividend there and it appears here instantly
          </p>
        </div>

        {/* Year navigation */}
        <div className="flex items-center gap-2">
          <button onClick={() => setYear((y) => Math.max(START_YEAR, y - 1))}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
            <ChevronLeft size={18} />
          </button>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="bg-slate-900 border border-slate-700 text-white font-bold text-lg px-4 py-2 rounded-xl">
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => setYear((y) => Math.min(START_YEAR + 14, y + 1))}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
            <ChevronRight size={18} />
          </button>
          <button onClick={load}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition" title="Refresh">
            {loading
              ? <Loader2 size={18} className="animate-spin" />
              : <span className="text-sm px-1">↻</span>}
          </button>
        </div>
      </div>

      {/* Annual summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: `${year} Gross Dividend`, value: `₹${Math.round(annualGross).toLocaleString()}`, color: "text-yellow-400" },
          { label: `${year} Total TDS`,      value: `₹${Math.round(annualTds).toLocaleString()}`,   color: "text-red-400"    },
          { label: `${year} Net Dividend`,   value: `₹${Math.round(annualNet).toLocaleString()}`,   color: "text-green-400"  },
          { label: "Monthly Average",        value: annualNet > 0 ? `₹${monthlyAvg.toLocaleString()}` : "—", color: "text-blue-400" },
        ].map(({ label, value, color }) => (
          <Card key={label} className="bg-white/10 border-white/10 rounded-2xl">
            <CardContent className="p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-3 justify-center py-20 text-slate-400">
          <Loader2 size={24} className="animate-spin" /> Loading dividend data…
        </div>
      ) : yearEntries.length === 0 ? (
        /* ── Empty state ─────────────────────────────────────────────────── */
        <Card className="bg-white/5 border-white/10 rounded-3xl mb-6">
          <CardContent className="py-16 text-center">
            <p className="text-4xl mb-4">📅</p>
            <p className="text-white font-semibold text-lg mb-1">No dividends logged for {year}</p>
            <p className="text-slate-400 text-sm">
              Go to the <strong className="text-yellow-400">Div Tracker</strong> tab,
              select year <strong className="text-white">{year}</strong>,
              click <strong className="text-green-400">+</strong> on any month card and log a dividend —
              it will appear here automatically.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── 12-month grid ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            {MONTH_NAMES.map((mName, mi) => {
              const es      = byMonth[mi];
              const netTot  = monthNet[mi];
              const grossTot= monthGross[mi];
              const tdsTot  = monthTds[mi];
              const isPeak  = mi === peakIdx && netTot > 0;

              return (
                <Card key={mName}
                  className={`border rounded-2xl transition-all ${
                    netTot > 0
                      ? isPeak
                        ? "bg-yellow-500/10 border-yellow-500/40 shadow-lg shadow-yellow-500/10"
                        : "bg-white/10 border-white/10"
                      : "bg-white/3 border-white/5 opacity-40"
                  }`}>
                  <CardContent className="p-4">
                    {/* Month header */}
                    <div className="flex items-center justify-between mb-3">
                      <span className={`font-bold text-base ${netTot > 0 ? "text-white" : "text-slate-500"}`}>
                        {mName}
                        {isPeak && <span className="ml-1 text-yellow-400 text-xs">★ Peak</span>}
                      </span>
                      {netTot > 0
                        ? <span className="text-xs font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                            ₹{Math.round(netTot).toLocaleString()}
                          </span>
                        : <span className="text-xs text-slate-600">No entry</span>}
                    </div>

                    {/* Entry list */}
                    {es.length === 0 ? (
                      <p className="text-xs text-slate-600 italic">—</p>
                    ) : (
                      <>
                        <div className="space-y-1.5">
                          {[...es].sort((a, b) => Number(b.netDiv) - Number(a.netDiv)).map((e) => (
                            <div key={e.id} className="flex items-center justify-between gap-2">
                              <span className="text-xs text-slate-300 truncate">{e.stockName}</span>
                              <span className="text-xs text-emerald-400 font-semibold flex-shrink-0">
                                ₹{Math.round(Number(e.netDiv)).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                        {/* Month footer */}
                        <div className="mt-2 pt-2 border-t border-white/5 flex justify-between text-[10px] text-slate-500">
                          <span>Gross ₹{Math.round(grossTot).toLocaleString()}</span>
                          <span>TDS ₹{Math.round(tdsTot).toLocaleString()}</span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* ── Monthly income bar timeline ───────────────────────────────── */}
          <Card className="bg-white/10 border-white/10 rounded-3xl mb-6">
            <CardContent className="p-6">
              <h3 className="text-base font-bold text-white mb-4">
                {year} Monthly Income Timeline (Net Dividend)
              </h3>
              <div className="flex items-end gap-2 h-32">
                {monthNet.map((net, mi) => {
                  const height = Math.round((net / maxBar) * 100);
                  return (
                    <div key={mi} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] text-slate-500 font-mono">
                        {net > 0 ? `₹${(net / 1000).toFixed(1)}k` : ""}
                      </span>
                      <div className="w-full rounded-t-md transition-all"
                        style={{
                          height: `${height}%`,
                          minHeight: net > 0 ? "4px" : "0",
                          background: mi === peakIdx && net > 0
                            ? "linear-gradient(to top, #f59e0b, #fcd34d)"
                            : "linear-gradient(to top, #34d399, #6ee7b7)",
                        }} />
                      <span className="text-[9px] text-slate-400">{MONTH_NAMES[mi].slice(0, 3)}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* ── Full year ledger table ────────────────────────────────────── */}
          <Card className="bg-white/10 border-white/10 rounded-3xl overflow-hidden">
            <CardContent className="p-0">
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-bold text-white">{year} Dividend Ledger</h3>
                <span className="text-xs text-slate-400">{yearEntries.length} entries</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-white">
                  <thead className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider">
                    <tr>
                      {["Month", "Stock", "Gross (₹)", "TDS (₹)", "Net (₹)", "Notes"].map((h) => (
                        <th key={h} className="p-3 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...yearEntries]
                      .sort((a, b) => Number(a.month) - Number(b.month))
                      .map((e) => (
                        <tr key={e.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="p-3 font-semibold text-slate-300">{MONTH_NAMES[Number(e.month) - 1]}</td>
                          <td className="p-3 font-bold text-green-400">{e.stockName}</td>
                          <td className="p-3 text-yellow-300">₹{Math.round(Number(e.grossDiv)).toLocaleString()}</td>
                          <td className="p-3 text-red-300">₹{Math.round(Number(e.tds)).toLocaleString()}</td>
                          <td className="p-3 text-emerald-400 font-bold">₹{Math.round(Number(e.netDiv)).toLocaleString()}</td>
                          <td className="p-3 text-slate-500 text-xs italic">{e.notes || "—"}</td>
                        </tr>
                      ))}
                    {/* Totals */}
                    <tr className="bg-white/5 font-bold border-t border-white/10">
                      <td className="p-3 text-slate-300" colSpan={2}>Total {year}</td>
                      <td className="p-3 text-yellow-400">₹{Math.round(annualGross).toLocaleString()}</td>
                      <td className="p-3 text-red-400">₹{Math.round(annualTds).toLocaleString()}</td>
                      <td className="p-3 text-emerald-400">₹{Math.round(annualNet).toLocaleString()}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
