import React, { useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TrendingUp, Wallet, IndianRupee, PieChart, Pencil, Trash2,
  Loader2, RefreshCw, FileSpreadsheet, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Card, CardContent, Button, Input, SummaryCard,
  STOCK_TYPES, TYPE_COLOR, EMPTY_FORM, calcStock } from "./utils.jsx";

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ChevronsUpDown size={12} className="opacity-30 ml-1 inline" />;
  return sortDir === "asc"
    ? <ChevronUp size={12} className="ml-1 inline text-green-400" />
    : <ChevronDown size={12} className="ml-1 inline text-green-400" />;
}

export default function PortfolioView({
  stocks, loading, saving, byType,
  showForm, form, editIndex,
  onOpenForm, onCloseForm, onFieldChange, onSubmit, onDelete, onRefresh, onPricesUpdate,
}) {
  const formRef = useRef(null);
  const [search,       setSearch]       = useState("");
  const [typeFilter,   setTypeFilter]   = useState("All");
  const [sortCol,      setSortCol]      = useState(null);
  const [sortDir,      setSortDir]      = useState("asc");
  const [fetchingPx,   setFetchingPx]   = useState(false);

  const pct = (n, d) => d ? ((n / d) * 100).toFixed(2) : "0.00";

  // ── Live price fetch ──────────────────────────────────────────────────────────
  const fetchLivePrices = async () => {
    const symboled = stocks.filter((s) => s.symbol);
    if (!symboled.length) {
      alert("No stocks have a Yahoo Symbol set. Edit each stock and add e.g. COALINDIA.NS");
      return;
    }
    setFetchingPx(true);
    try {
      const symbols = symboled.map((s) => s.symbol);
      const res     = await fetch("/api/prices", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ symbols }),
      });
      const prices = await res.json();
      const updated = stocks.map((s) =>
        prices[s.symbol] ? { ...s, currentPrice: prices[s.symbol] } : s
      );
      await onPricesUpdate(updated);
    } catch {
      alert("Failed to fetch live prices. Check your internet connection.");
    } finally {
      setFetchingPx(false);
    }
  };
  const fmt = (n) => Number(n).toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  const totalInv = stocks.reduce((s, x) => s + x.qty * x.avgPrice,     0);
  const totalCur = stocks.reduce((s, x) => s + x.qty * x.currentPrice, 0);
  const totalDiv = stocks.reduce((s, x) => s + (x.divQty||x.qty) * x.dividend, 0);
  const totalPnL = totalCur - totalInv;
  const totalNet = stocks.reduce((s, x) => s + (x.netDividend ?? 0),   0);
  const totalTDS = totalDiv - totalNet;   // gross - net = TDS deducted
  const overall  = totalPnL + totalNet;

  const filtered = stocks
    .map(calcStock)
    .filter((s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) &&
      (typeFilter === "All" || s.type === typeFilter)
    );

  const numCols = ["qty","avgPrice","currentPrice","inv","cur","pnl","retPct","gross","tdsPct","tdsAmt","net","yieldPct","overall"];
  const sorted = [...filtered].sort((a, b) => {
    if (!sortCol) return 0;
    const av = numCols.includes(sortCol) ? Number(a[sortCol]) : String(a[sortCol]);
    const bv = numCols.includes(sortCol) ? Number(b[sortCol]) : String(b[sortCol]);
    return (av < bv ? -1 : av > bv ? 1 : 0) * (sortDir === "asc" ? 1 : -1);
  });

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const TH = ({ label, col }) => (
    <th onClick={col ? () => handleSort(col) : undefined}
      className={`p-4 text-left font-bold whitespace-nowrap ${col ? "cursor-pointer hover:text-white" : ""}`}>
      {label}<SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
    </th>
  );

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
        <SummaryCard color="cyan"    icon={<IndianRupee />} label="Total Investment"       value={`₹${fmt(totalInv)}`} />
        <SummaryCard color="green"   icon={<TrendingUp  />} label="Portfolio P&L"          value={`₹${fmt(totalPnL)}`}       positive={totalPnL >= 0} />
        <SummaryCard color="blue"    icon={<PieChart    />} label="Stocks Return %"        value={`${pct(totalPnL, totalInv)}%`}          positive={totalPnL >= 0} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
        <SummaryCard color="yellow"  icon={<IndianRupee />} label="Yearly Gross Dividend"  value={`₹${fmt(totalDiv)}`} />
        <SummaryCard color="orange"  icon={<Wallet      />} label="Net Dividend after TDS" value={`₹${fmt(totalNet)}`} sub="After TDS deductions" />
        <SummaryCard color="red"     icon={<IndianRupee />} label="Total TDS Deducted"      value={`₹${fmt(totalTDS)}`} sub="Gross − Net dividend" />
        <SummaryCard color="blue"    icon={<TrendingUp  />} label="Dividend Yield"         value={`${pct(totalDiv, totalInv)}%`} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        <SummaryCard color="emerald" icon={<IndianRupee />} label="Overall Portfolio Returns" value={`₹${fmt(overall)}`} positive={overall >= 0} sub="Stock P&L + Net Dividend" />
        <SummaryCard color="cyan"    icon={<PieChart    />} label="Overall Return %"          value={`${pct(overall, totalInv)}%`}              positive={overall >= 0} />
      </div>

      {/* Type breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {byType.map(({ type, count, investment, pnl, grossDiv }) => (
          <Card key={type} className="bg-white/10 border-white/10 backdrop-blur-xl rounded-3xl shadow-2xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${TYPE_COLOR[type]}`}>{type}</span>
                <span className="text-slate-400 text-xs">{count} holding{count !== 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Invested</span><span className="text-white font-semibold">₹{fmt(investment)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">P&L</span><span className={`font-bold ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>₹{fmt(pnl)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Gross Div</span><span className="text-yellow-400 font-semibold">₹{fmt(grossDiv)}</span></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Button onClick={() => onOpenForm()} className="h-10 px-5 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold">+ Add Stock</Button>
        <Button onClick={onRefresh} className="h-10 px-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center gap-2"><RefreshCw size={14} /> Refresh</Button>
        <Button onClick={fetchLivePrices} disabled={fetchingPx}
          className="h-10 px-4 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-bold flex items-center gap-2 disabled:opacity-50">
          {fetchingPx ? <><Loader2 size={14} className="animate-spin" /> Fetching…</> : <>📶 Fetch Live Prices</>}
        </Button>
        {loading && <Loader2 size={15} className="animate-spin text-slate-400" />}
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Input placeholder="🔍  Search stocks…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="bg-slate-900 border border-slate-700 h-9 rounded-xl text-white w-56 text-sm px-3" />
        <div className="flex gap-2">
          {["All", ...STOCK_TYPES].map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`h-9 px-4 rounded-xl text-xs font-bold border transition-colors
                ${typeFilter === t ? "bg-green-600 border-green-500 text-white" : "bg-white/5 border-white/10 text-slate-400 hover:text-white"}`}>
              {t}
            </button>
          ))}
        </div>
        {(search || typeFilter !== "All") && <span className="text-xs text-slate-500">{sorted.length} of {stocks.length} shown</span>}
      </div>

      {/* Add / Edit form */}
      <AnimatePresence>
        {showForm && (
          <motion.div ref={formRef} id="stock-form-section"
            initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }} className="mb-6">
            <Card className="bg-white/10 border-white/10 backdrop-blur-xl rounded-3xl shadow-2xl">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-white mb-5">{editIndex !== null ? "✏️ Edit Stock" : "➕ Add New Stock"}</h3>
                <form onSubmit={onSubmit} noValidate>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">Type *</label>
                      <select name="type" value={form.type} onChange={onFieldChange}
                        className="w-full bg-slate-900 border border-slate-700 h-12 rounded-xl text-white px-3 text-sm">
                        {STOCK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    {[
                      { name:"name",         label:"Stock / Fund Name *",       type:"text",   ph:"e.g. ITC Limited" },
                      { name:"sector",        label:"Sector",                    type:"text",   ph:"e.g. FMCG / PSU" },
                      { name:"symbol",        label:"Yahoo Symbol (for live price)", type:"text", ph:"e.g. ITC.NS or ICICIBANK.BO" },
                      { name:"qty",           label:"Quantity *",                type:"number", ph:"e.g. 250" },
                      { name:"divQty",        label:"Dividend Quantity",         type:"number", ph:"defaults to Qty" },
                      { name:"avgPrice",      label:"Avg Buy Price (₹) *",       type:"number", ph:"e.g. 430" },
                      { name:"currentPrice",  label:"Current Price (₹) *",       type:"number", ph:"e.g. 465" },
                      { name:"dividend",      label:"Annual Dividend (₹/share)", type:"number", ph:"e.g. 25" },
                      { name:"netDividend",   label:"Net Dividend (₹) received", type:"number", ph:"e.g. 4500" },
                    ].map(({ name, label, type, ph }) => (
                      <div key={name}>
                        <label className="text-xs text-slate-400 mb-1 block uppercase tracking-wider">{label}</label>
                        <Input name={name} type={type} placeholder={ph} value={form[name]} onChange={onFieldChange}
                          className="bg-slate-900 border border-slate-700 h-12 rounded-xl text-white px-3" />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <Button type="submit" disabled={saving}
                      className="h-11 px-8 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold flex items-center gap-2">
                      {saving && <Loader2 size={15} className="animate-spin" />}
                      {editIndex !== null ? "Update Stock" : "Add to Portfolio"}
                    </Button>
                    <Button type="button" onClick={onCloseForm} className="h-11 px-6 rounded-xl bg-red-500/80 hover:bg-red-500 text-white font-bold">Cancel</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Holdings table */}
      <Card className="w-full bg-white/10 border-white/10 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="p-5 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-2xl font-bold text-violet-300">Portfolio Holdings</h2>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <FileSpreadsheet size={13} className="text-green-400" />
              {stocks.length} stocks · synced with <code className="text-green-400 ml-1">data/portfolio.xlsx</code>
            </span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-20 text-slate-400">
              <Loader2 size={26} className="animate-spin" /><span>Reading from Excel…</span>
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-white font-semibold mb-1">{stocks.length === 0 ? "No holdings yet" : "No matches found"}</p>
              <p>{stocks.length === 0 ? "Click + Add Stock to begin." : "Clear search or filter."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[2200px] text-white text-sm">
                <thead className="bg-white/5 text-slate-300 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-4 text-left font-bold">Edit</th>
                    <TH label="#" /><TH label="Stock / Fund" col="name" /><TH label="Type" col="type" />
                    <TH label="Sector" col="sector" /><TH label="Qty" col="qty" />
                    <TH label="Div Qty" col="divQty" />
                    <TH label="Avg Buy (₹)" col="avgPrice" /><TH label="Current (₹)" col="currentPrice" />
                    <TH label="Investment (₹)" col="inv" /><TH label="Current Value (₹)" col="cur" />
                    <TH label="P&L (₹)" col="pnl" /><TH label="Return %" col="retPct" />
                    <TH label="Div/Share (₹)" col="dividend" /><TH label="Gross Div (₹)" col="gross" />
                    <TH label="TDS %" col="tdsPct" /><TH label="TDS Amt (₹)" col="tdsAmt" />
                    <TH label="Net Div (₹)" col="net" /><TH label="Div Yield %" col="yieldPct" />
                    <TH label="Overall Returns (₹)" col="overall" />
                    <th className="p-4 text-left font-bold">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s, idx) => (
                    <motion.tr key={s.name} initial={{ opacity:0 }} animate={{ opacity:1 }}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <button onClick={() => onOpenForm(s, stocks.findIndex((x) => x.name === s.name))} title="Edit"
                          className="bg-blue-500/20 hover:bg-blue-500/40 p-2 rounded-xl transition"><Pencil size={14} className="text-blue-300" /></button>
                      </td>
                      <td className="p-4 text-slate-400">{idx + 1}</td>
                      <td className="p-4 font-bold text-green-400 whitespace-nowrap">{s.name}</td>
                      <td className="p-4"><span className={`text-xs font-semibold px-2 py-1 rounded-full border ${TYPE_COLOR[s.type] ?? TYPE_COLOR.Equity}`}>{s.type}</span></td>
                      <td className="p-4 text-slate-400 text-xs whitespace-nowrap">{s.sector || "—"}</td>
                      <td className="p-4">{s.qty.toLocaleString()}</td>
                      <td className="p-4 text-cyan-300">{s.divQty ? s.divQty.toLocaleString() : <span className="text-slate-500 text-xs italic">= Qty</span>}</td>
                      <td className="p-4">₹{fmt(s.avgPrice)}</td>
                      <td className="p-4 text-yellow-300">₹{fmt(s.currentPrice)}</td>
                      <td className="p-4 font-semibold">₹{fmt(s.inv)}</td>
                      <td className="p-4 text-blue-300 font-semibold">₹{fmt(s.cur)}</td>
                      <td className={`p-4 font-bold ${s.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>₹{fmt(s.pnl)}</td>
                      <td className={`p-4 font-bold ${s.retPct >= 0 ? "text-green-400" : "text-red-400"}`}>{s.retPct.toFixed(2)}%</td>
                      <td className="p-4 text-yellow-400">₹{fmt(s.dividend)}</td>
                      <td className="p-4 text-green-300 font-semibold">₹{fmt(s.gross)}</td>
                      <td className="p-4 text-orange-300">{s.tdsPct.toFixed(2)}%</td>
                      <td className="p-4 text-red-300">₹{fmt(s.tdsAmt)}</td>
                      <td className="p-4 text-emerald-300 font-bold">₹{fmt(s.net)}</td>
                      <td className="p-4 text-emerald-400 font-bold">{s.yieldPct.toFixed(2)}%</td>
                      <td className={`p-4 font-bold ${s.overall >= 0 ? "text-green-400" : "text-red-400"}`}>₹{fmt(s.overall)}</td>
                      <td className="p-4">
                        <button onClick={() => onDelete(stocks.findIndex((x) => x.name === s.name))} title="Delete"
                          className="bg-red-500/20 hover:bg-red-500/40 p-2 rounded-xl transition"><Trash2 size={14} className="text-red-300" /></button>
                      </td>
                    </motion.tr>
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
