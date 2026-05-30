import React, { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Card, CardContent } from "./utils.jsx";
import { Button } from "./utils.jsx";
import { Input } from "./utils.jsx";
import {
  Loader2, Plus, Pencil, Trash2, Download,
  ChevronLeft, ChevronRight, IndianRupee, TrendingUp,
} from "lucide-react";
import { MONTH_NAMES } from "./utils.jsx";

// ── constants ─────────────────────────────────────────────────────────────────

const START_YEAR  = new Date().getFullYear();
const YEARS       = Array.from({ length: 15 }, (_, i) => START_YEAR + i);
const QUARTERS    = [
  { label: "Q1", months: [1, 2, 3] },
  { label: "Q2", months: [4, 5, 6] },
  { label: "Q3", months: [7, 8, 9] },
  { label: "Q4", months: [10, 11, 12] },
];

const EMPTY_ENTRY = {
  stockName: "", divAmtPerShare: "", divQty: "",
  grossDiv: "", netDiv: "",
};

const apiDiv = {
  load:   ()          => fetch("/api/dividends").then((r) => r.json()),
  add:    (body)      => fetch("/api/dividends", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json()),
  update: (id, body)  => fetch(`/api/dividends/${id}`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json()),
  remove: (id)        => fetch(`/api/dividends/${id}`, { method: "DELETE" }).then((r) => r.json()),
};

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;

// ── Main component ────────────────────────────────────────────────────────────

export default function DividendTrackerView({ stocks, showToast, refreshKey = 0 }) {
  const [entries,   setEntries]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [year,      setYear]      = useState(START_YEAR);
  const [modal,     setModal]     = useState(null); // { month, entry|null }
  const [form,      setForm]      = useState(EMPTY_ENTRY);
  const [editId,    setEditId]    = useState(null);
  const [expandedMonth, setExpanded] = useState(null);

  // ── data ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try   { setEntries(await apiDiv.load()); }
    catch { showToast("Cannot load dividends. Is server running?", false); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  // ── form helpers ──────────────────────────────────────────────────────────

  const openAdd = (month) => {
    setForm(EMPTY_ENTRY);
    setEditId(null);
    setModal({ month });
  };

  const openEdit = (entry) => {
    setForm({
      stockName:      entry.stockName,
      divAmtPerShare: entry.divAmtPerShare,
      divQty:         entry.divQty,
      grossDiv:       entry.grossDiv,
      netDiv:         entry.netDiv,
    });
    setEditId(entry.id);
    setModal({ month: entry.month });
  };

  const closeModal = () => { setModal(null); setEditId(null); setForm(EMPTY_ENTRY); };

  const handleField = (e) => {
    const { name, value } = e.target;
    setForm((f) => {
      const next = { ...f, [name]: value };
      // grossDiv = divAmtPerShare × divQty (full precision — no rounding)
      if (name === "divAmtPerShare" || name === "divQty") {
        const rate  = parseFloat(name === "divAmtPerShare" ? value : next.divAmtPerShare) || 0;
        const qty   = parseFloat(name === "divQty"         ? value : next.divQty)         || 0;
        next.grossDiv = rate && qty ? parseFloat((rate * qty).toFixed(3)) : "";
      }
      return next;
    });
  };

  const handleStockSelect = (e) => {
    const name  = e.target.value;
    const stock = stocks.find((s) => s.name === name);
    setForm((f) => ({
      ...f,
      stockName:      name,
      divAmtPerShare: stock ? (stock.dividend || "") : "",
      divQty:         stock ? (stock.qty       || "") : "",
      grossDiv:       stock ? parseFloat(((stock.dividend || 0) * (stock.qty || 0)).toFixed(3)) : "",
      netDiv:         "",
    }));
  };

  // ── CRUD ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    const gross = parseFloat(form.grossDiv) || 0;
    const net   = parseFloat(form.netDiv)   || 0;
    const tds   = parseFloat((Math.max(0, gross - net)).toFixed(3));
    if (!form.stockName || !gross || !net) {
      showToast("Stock, Gross Div and Net Div are required.", false); return;
    }
    const payload = {
      year, month: modal.month,
      stockName:      form.stockName,
      divAmtPerShare: parseFloat(form.divAmtPerShare) || 0,
      divQty:         parseFloat(form.divQty)         || 0,
      grossDiv:       gross,
      tds,
      netDiv:         net,
      notes:          "",
    };
    setSaving(true);
    try {
      const updated = editId
        ? await apiDiv.update(editId, payload)
        : await apiDiv.add(payload);
      setEntries(updated);
      showToast(editId ? "Entry updated in dividends.xlsx!" : "Entry saved to dividends.xlsx!");
      closeModal();
    } catch { showToast("Save failed.", false); }
    finally   { setSaving(false); }
  };

  const handleDelete = async (id, stockName) => {
    if (!window.confirm(`Remove dividend entry for "${stockName}"?`)) return;
    setSaving(true);
    try   { setEntries(await apiDiv.remove(id)); showToast("Entry removed."); }
    catch { showToast("Delete failed.", false); }
    finally { setSaving(false); }
  };

  // ── derived: filter by selected year ─────────────────────────────────────

  const yearEntries  = entries.filter((e) => Number(e.year) === year);

  const monthTotal   = (m) => yearEntries.filter((e) => Number(e.month) === m)
    .reduce((s, e) => ({ gross: s.gross + e.grossDiv, tds: s.tds + e.tds, net: s.net + e.netDiv }),
      { gross: 0, tds: 0, net: 0 });

  const quarterTotal = (months) => months.reduce((acc, m) => {
    const t = monthTotal(m);
    return { gross: acc.gross + t.gross, tds: acc.tds + t.tds, net: acc.net + t.net };
  }, { gross: 0, tds: 0, net: 0 });

  const annualTotal = quarterTotal([1,2,3,4,5,6,7,8,9,10,11,12]);

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent mb-1">
            📋 Month-wise Dividend Tracker
          </h2>
          <p className="text-slate-400 text-sm">
            Log every dividend received · saved to <code className="text-green-400">data/dividends.xlsx</code> · 2026 – 2040
          </p>
        </div>
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
          <button onClick={() => window.open("/api/dividends/download","_blank")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition">
            <Download size={15} /> Export xlsx
          </button>
        </div>
      </div>

      {/* Annual summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label:`${year} Gross Dividend`, value: fmt(annualTotal.gross), color:"text-yellow-400" },
          { label:`${year} Total TDS`,      value: fmt(annualTotal.tds),   color:"text-red-400"    },
          { label:`${year} Net Dividend`,   value: fmt(annualTotal.net),   color:"text-green-400"  },
          { label:"Total Entries",          value: yearEntries.length,     color:"text-blue-400"   },
        ].map(({ label, value, color }) => (
          <Card key={label} className="bg-white/10 border-white/10 rounded-2xl">
            <CardContent className="p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quarterly summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {QUARTERS.map(({ label, months }) => {
          const qt = quarterTotal(months);
          return (
            <Card key={label} className="bg-white/5 border-white/10 rounded-2xl">
              <CardContent className="p-4">
                <p className="text-xs font-bold text-slate-400 mb-2">{label} ({MONTH_NAMES[months[0]-1]}–{MONTH_NAMES[months[2]-1]})</p>
                <p className="text-base font-bold text-green-400">{fmt(qt.net)} <span className="text-slate-500 text-xs font-normal">net</span></p>
                <p className="text-xs text-slate-500 mt-0.5">Gross {fmt(qt.gross)} · TDS {fmt(qt.tds)}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 12-month grid */}
      {loading ? (
        <div className="flex items-center gap-3 justify-center py-20 text-slate-400">
          <Loader2 size={24} className="animate-spin" /> Loading dividend entries…
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {MONTH_NAMES.map((mName, mi) => {
            const m      = mi + 1;
            const mData  = yearEntries.filter((e) => Number(e.month) === m);
            const totals = monthTotal(m);
            const isOpen = expandedMonth === m;

            return (
              <Card key={m} className={`border rounded-2xl transition-all ${
                totals.net > 0 ? "bg-white/10 border-white/10" : "bg-white/3 border-white/5"
              }`}>
                <CardContent className="p-4">
                  {/* Month header */}
                  <div className="flex items-center justify-between mb-3">
                    <button onClick={() => setExpanded(isOpen ? null : m)}
                      className="flex items-center gap-2 group">
                      <span className="font-bold text-white group-hover:text-green-400 transition">{mName} {year}</span>
                      {totals.net > 0 && (
                        <span className="text-xs bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full font-semibold">
                          {fmt(totals.net)}
                        </span>
                      )}
                    </button>
                    <button onClick={() => openAdd(m)}
                      className="p-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/40 text-green-400 transition" title="Add entry">
                      <Plus size={14} />
                    </button>
                  </div>

                  {/* Entries (collapsed: show 2, expanded: show all) */}
                  {mData.length === 0 ? (
                    <p className="text-xs text-slate-600 italic">No entries — click + to add</p>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        {(isOpen ? mData : mData.slice(0, 2)).map((entry) => (
                          <div key={entry.id}
                            className="flex items-center justify-between gap-2 bg-white/5 rounded-lg px-2.5 py-1.5 group">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate">{entry.stockName}</p>
                              <p className="text-[10px] text-slate-500">
                                Gross {fmt(entry.grossDiv)} · TDS {fmt(entry.tds)}
                                {entry.notes && ` · ${entry.notes}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className="text-xs font-bold text-emerald-400">{fmt(entry.netDiv)}</span>
                              <button onClick={() => openEdit(entry)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/40 transition">
                                <Pencil size={11} className="text-blue-300" />
                              </button>
                              <button onClick={() => handleDelete(entry.id, entry.stockName)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg bg-red-500/20 hover:bg-red-500/40 transition">
                                <Trash2 size={11} className="text-red-300" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {mData.length > 2 && (
                        <button onClick={() => setExpanded(isOpen ? null : m)}
                          className="text-[10px] text-slate-500 hover:text-slate-300 mt-1.5 transition">
                          {isOpen ? "▲ Show less" : `▼ +${mData.length - 2} more`}
                        </button>
                      )}
                      {/* Month totals footer */}
                      {mData.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-white/5 flex justify-between text-[10px] text-slate-500">
                          <span>Gross {fmt(totals.gross)}</span>
                          <span>TDS {fmt(totals.tds)}</span>
                          <span className="text-emerald-500 font-semibold">Net {fmt(totals.net)}</span>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Full year table */}
      {yearEntries.length > 0 && (
        <Card className="bg-white/10 border-white/10 rounded-3xl overflow-hidden">
          <CardContent className="p-0">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2">
                <IndianRupee size={15} className="text-green-400" /> {year} Full Ledger
              </h3>
              <span className="text-xs text-slate-400">{yearEntries.length} entr{yearEntries.length !== 1 ? "ies" : "y"}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-white">
                <thead className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    {["Month","Stock","Rate/Share","Div Qty","Gross Div (₹)","TDS (₹)","Net Div (₹)","Notes",""].map((h) => (
                      <th key={h} className="p-3 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...yearEntries]
                    .sort((a, b) => Number(a.month) - Number(b.month))
                    .map((entry) => (
                      <tr key={entry.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                        <td className="p-3 text-slate-300 font-semibold">{MONTH_NAMES[Number(entry.month) - 1]}</td>
                        <td className="p-3 font-bold text-green-400">{entry.stockName}</td>
                        <td className="p-3 text-yellow-200 text-xs">₹{entry.divAmtPerShare || "—"}</td>
                        <td className="p-3 text-slate-300 text-xs">{entry.divQty || "—"}</td>
                        <td className="p-3 text-yellow-300">{fmt(entry.grossDiv)}</td>
                        <td className="p-3 text-red-300">{fmt(entry.tds)}</td>
                        <td className="p-3 text-emerald-400 font-bold">{fmt(entry.netDiv)}</td>
                        <td className="p-3 text-slate-500 text-xs italic">{entry.notes || "—"}</td>
                        <td className="p-3">
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                            <button onClick={() => openEdit(entry)}
                              className="p-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/40">
                              <Pencil size={12} className="text-blue-300" />
                            </button>
                            <button onClick={() => handleDelete(entry.id, entry.stockName)}
                              className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40">
                              <Trash2 size={12} className="text-red-300" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  {/* Totals row */}
                  <tr className="bg-white/5 font-bold">
                    <td className="p-3 text-slate-300" colSpan={4}>Total {year}</td>
                    <td className="p-3 text-yellow-400">{fmt(annualTotal.gross)}</td>
                    <td className="p-3 text-red-400">{fmt(annualTotal.tds)}</td>
                    <td className="p-3 text-emerald-400">{fmt(annualTotal.net)}</td>
                    <td colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={(e) => e.target === e.currentTarget && closeModal()}>
            <motion.div
              initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
              className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl shadow-2xl p-6">

              <h3 className="text-xl font-bold text-white mb-1">
                {editId ? "✏️ Edit Entry" : "➕ Add Dividend Entry"}
              </h3>
              <p className="text-sm text-slate-400 mb-5">
                {MONTH_NAMES[modal.month - 1]} {year} · saved to dividends.xlsx
              </p>

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {/* Stock selector */}
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Stock / Fund *</label>
                  <select name="stockName" value={form.stockName} onChange={handleStockSelect}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl h-11 px-3 text-sm">
                    <option value="">— Select from portfolio —</option>
                    {stocks.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                    <option value="__custom__">Other (type below)</option>
                  </select>
                  {form.stockName === "__custom__" && (
                    <Input name="stockName" placeholder="Type stock name" value=""
                      onChange={(e) => setForm((f) => ({ ...f, stockName: e.target.value }))}
                      className="mt-2 bg-slate-800 border-slate-700 h-11 rounded-xl text-white text-sm" />
                  )}
                </div>

                {/* Div Rate + Qty */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-yellow-400 uppercase tracking-wider mb-1 block">💰 Div Amount / Share (₹)</label>
                    <Input name="divAmtPerShare" type="number" step="0.001"
                      placeholder="e.g. 5.500"
                      value={form.divAmtPerShare} onChange={handleField}
                      className="bg-slate-800 border-yellow-600/50 h-11 rounded-xl text-white text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-yellow-400 uppercase tracking-wider mb-1 block">📦 Dividend Quantity</label>
                    <Input name="divQty" type="number" step="1"
                      placeholder="e.g. 100"
                      value={form.divQty} onChange={handleField}
                      className="bg-slate-800 border-yellow-600/50 h-11 rounded-xl text-white text-sm" />
                  </div>
                </div>

                {/* Gross (auto) + Net (user types) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase mb-1 block">⚡ Gross Div (₹) — auto</label>
                    <Input name="grossDiv" type="number" step="0.001"
                      placeholder="auto from Rate × Qty"
                      value={form.grossDiv} onChange={handleField}
                      className="bg-slate-900/60 border-slate-700 h-11 rounded-xl text-sm text-yellow-300" />
                  </div>
                  <div>
                    <label className="text-xs text-yellow-400 uppercase tracking-wider mb-1 block">🟡 Net Div (₹) *</label>
                    <Input name="netDiv" type="number" step="0.001"
                      placeholder="actual received e.g. 450.000"
                      value={form.netDiv} onChange={handleField}
                      className="bg-slate-800 border-yellow-600/50 h-11 rounded-xl text-sm text-emerald-300" />
                  </div>
                </div>

                {/* TDS — derived display, not an input */}
                {form.grossDiv && form.netDiv && (
                  <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between text-sm">
                    <span className="text-slate-400">TDS (auto = Gross − Net)</span>
                    <span className="font-bold text-red-400">
                      {fmt(Math.max(0, (parseFloat(form.grossDiv)||0) - (parseFloat(form.netDiv)||0)))}
                    </span>
                  </div>
                )}



                <div className="flex gap-3 pt-1">
                  <Button type="submit" disabled={saving}
                    className="flex-1 h-11 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                    {saving && <Loader2 size={14} className="animate-spin" />}
                    {editId ? "Update Entry" : "Save to Excel"}
                  </Button>
                  <Button type="button" onClick={closeModal}
                    className="h-11 px-5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold">
                    Cancel
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
