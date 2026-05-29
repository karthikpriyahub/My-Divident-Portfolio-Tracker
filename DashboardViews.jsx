import React, { useState, useEffect } from "react";
import { Card, CardContent, Button, Input, TYPE_COLOR } from "./utils.jsx";
import { Loader2, RefreshCw, Save, TrendingUp, TrendingDown, Target, IndianRupee, Zap } from "lucide-react";
import api from "./utils.jsx";

// ══════════════════════════════════════════════════════════════════════════════
// Quick Price Update View
// ══════════════════════════════════════════════════════════════════════════════

export function QuickUpdateView({ stocks, onStocksChange, showToast }) {
  const [prices,  setPrices]  = useState({});
  const [saving,  setSaving]  = useState(false);

  useEffect(() => { setPrices({}); }, [stocks]);

  const setPrice = (i, val) => setPrices((p) => ({ ...p, [i]: val }));

  const changedCount = Object.keys(prices).filter(
    (i) => prices[i] !== "" && Number(prices[i]) !== stocks[Number(i)]?.currentPrice
  ).length;

  const handleSaveAll = async () => {
    const updated = stocks.map((s, i) => {
      const raw = prices[i];
      const val = raw !== undefined && raw !== "" ? Number(raw) : null;
      return val !== null && !isNaN(val) ? { ...s, currentPrice: val } : s;
    });
    setSaving(true);
    try {
      onStocksChange(await api.bulkUpdate(updated));
      setPrices({});
      showToast(`Updated ${changedCount} price${changedCount !== 1 ? "s" : ""} in Excel!`);
    } catch { showToast("Save failed.", false); }
    finally   { setSaving(false); }
  };

  return (
    <>
      <div className="mb-6">
        <h2 className="text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent mb-1">⚡ Quick Price Update</h2>
        <p className="text-slate-400">Tab through prices, update all in one click. Changes auto-save to Excel.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Button onClick={handleSaveAll} disabled={saving || changedCount === 0}
          className="h-11 px-8 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold flex items-center gap-2">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Save All {changedCount > 0 ? `(${changedCount} changed)` : ""}
        </Button>
        <Button onClick={() => setPrices({})} className="h-11 px-5 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center gap-2">
          <RefreshCw size={14} /> Reset
        </Button>
        {changedCount > 0 && <span className="text-sm text-yellow-400 font-semibold animate-pulse">{changedCount} unsaved change{changedCount !== 1 ? "s" : ""}</span>}
      </div>
      <Card className="bg-white/10 border-white/10 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-white">
              <thead className="bg-white/5 text-slate-300 text-xs uppercase tracking-wider">
                <tr>{["#","Stock / Fund","Type","Sector","Avg Buy (₹)","Old Price (₹)","New Price (₹)","Change (₹)","Change %","vs Avg Buy"].map((h) => (
                  <th key={h} className="p-4 text-left font-bold whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {stocks.map((stock, i) => {
                  const oldPrice = stock.currentPrice;
                  const rawNew   = prices[i];
                  const newPrice = rawNew !== undefined && rawNew !== "" ? Number(rawNew) : oldPrice;
                  const changed  = rawNew !== undefined && rawNew !== "" && newPrice !== oldPrice;
                  const diff     = newPrice - oldPrice;
                  const diffPct  = oldPrice > 0 ? (diff / oldPrice) * 100 : 0;
                  const vsAvgPct = stock.avgPrice > 0 ? ((newPrice - stock.avgPrice) / stock.avgPrice) * 100 : 0;
                  return (
                    <tr key={i} className={`border-b border-white/5 transition-colors ${changed ? "bg-yellow-500/5" : "hover:bg-white/5"}`}>
                      <td className="p-4 text-slate-400">{i+1}</td>
                      <td className="p-4 font-bold text-green-400 whitespace-nowrap">{stock.name}</td>
                      <td className="p-4"><span className={`text-xs font-semibold px-2 py-1 rounded-full border ${TYPE_COLOR[stock.type] ?? TYPE_COLOR.Equity}`}>{stock.type}</span></td>
                      <td className="p-4 text-slate-400 text-xs">{stock.sector || "—"}</td>
                      <td className="p-4 text-slate-300">₹{stock.avgPrice.toLocaleString()}</td>
                      <td className="p-4 text-slate-300">₹{oldPrice.toLocaleString()}</td>
                      <td className="p-3">
                        <input type="number" placeholder={oldPrice} value={prices[i] ?? ""}
                          onChange={(e) => setPrice(i, e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && document.querySelector(`#price-${i+1}`)?.focus()}
                          id={`price-${i}`}
                          className={`w-28 bg-slate-900 border rounded-xl px-3 py-2 text-white text-sm outline-none focus:ring-2 transition-all
                            ${changed ? "border-yellow-500 focus:ring-yellow-500/40" : "border-slate-700 focus:ring-green-500/40"}`} />
                      </td>
                      <td className={`p-4 font-semibold ${changed ? (diff >= 0 ? "text-green-400" : "text-red-400") : "text-slate-500"}`}>
                        {changed ? `${diff >= 0 ? "+" : ""}₹${diff.toFixed(2)}` : "—"}
                      </td>
                      <td className={`p-4 font-semibold ${changed ? (diffPct >= 0 ? "text-green-400" : "text-red-400") : "text-slate-500"}`}>
                        {changed ? `${diffPct >= 0 ? "+" : ""}${diffPct.toFixed(2)}%` : "—"}
                      </td>
                      <td className="p-4">
                        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full w-fit
                          ${vsAvgPct >= 15 ? "bg-green-500/20 text-green-300" : vsAvgPct >= 0 ? "bg-blue-500/20 text-blue-300" : "bg-red-500/20 text-red-300"}`}>
                          {vsAvgPct >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                          {vsAvgPct >= 0 ? "+" : ""}{vsAvgPct.toFixed(1)}% vs avg
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-white/10 text-xs text-slate-500">
            💡 Press <kbd className="bg-white/10 px-1.5 py-0.5 rounded">Enter</kbd> to move to next row · saves to <code className="text-green-400">data/portfolio.xlsx</code>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Monthly Income Goal View
// ══════════════════════════════════════════════════════════════════════════════

const GOAL_KEY   = "portfolio_monthly_goal";
const MILESTONES = [5000, 10000, 25000, 50000, 100000];

export function GoalView({ stocks }) {
  const [goal,     setGoal]     = useState(() => Number(localStorage.getItem(GOAL_KEY) || 10000));
  const [inputVal, setInputVal] = useState("");
  const [editing,  setEditing]  = useState(false);

  useEffect(() => { localStorage.setItem(GOAL_KEY, goal); }, [goal]);

  const totalNet  = stocks.reduce((s, x) => s + (x.netDividend ?? 0), 0);
  const totalGross= stocks.reduce((s, x) => s + x.qty * x.dividend,   0);
  const totalInv  = stocks.reduce((s, x) => s + x.qty * x.avgPrice,   0);

  const monthly   = totalNet / 12;
  const progress  = goal > 0 ? Math.min((monthly / goal) * 100, 100) : 0;
  const gap       = Math.max(goal - monthly, 0);
  const avgYield  = totalInv > 0 ? totalGross / totalInv : 0;
  const investNeeded = avgYield > 0 ? (gap * 12) / avgYield : 0;
  const nextM     = MILESTONES.find((m) => m > monthly);

  const StatCard = ({ icon, label, value, sub, color = "text-white" }) => (
    <Card className="bg-white/10 border-white/10 rounded-2xl">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-2 text-slate-400">{icon}<span className="text-xs uppercase tracking-wider">{label}</span></div>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );

  return (
    <>
      <div className="mb-6">
        <h2 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-1">🎯 Monthly Income Goal</h2>
        <p className="text-slate-400">Track your passive income progress and know exactly how much more to invest.</p>
      </div>

      {/* Goal setter */}
      <Card className="bg-gradient-to-r from-purple-900/40 to-pink-900/30 border-purple-500/30 rounded-3xl mb-8">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="text-xs text-purple-300 uppercase tracking-wider mb-1">Monthly Income Goal</p>
              {editing ? (
                <div className="flex items-center gap-2">
                  <span className="text-white text-xl font-bold">₹</span>
                  <input autoFocus type="number" value={inputVal} placeholder={goal}
                    onChange={(e) => setInputVal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { const v = Number(inputVal); if (v > 0) { setGoal(v); setEditing(false); setInputVal(""); }}}}
                    className="bg-slate-900 border border-purple-500 rounded-xl px-3 py-2 text-white text-xl font-bold w-40 outline-none" />
                  <Button onClick={() => { const v = Number(inputVal); if (v > 0) { setGoal(v); setEditing(false); setInputVal(""); }}}
                    className="h-10 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold">Set</Button>
                  <Button onClick={() => setEditing(false)} className="h-10 px-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm">Cancel</Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <p className="text-4xl font-black text-purple-300">₹{goal.toLocaleString()}</p>
                  <button onClick={() => { setEditing(true); setInputVal(goal); }}
                    className="text-xs text-purple-400 hover:text-purple-200 border border-purple-500/40 px-2 py-1 rounded-lg">Edit</button>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-2">Quick set:</p>
              <div className="flex flex-wrap gap-2">
                {MILESTONES.map((m) => (
                  <button key={m} onClick={() => setGoal(m)}
                    className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-colors
                      ${goal === m ? "bg-purple-600 border-purple-500 text-white" : "bg-white/5 border-white/10 text-slate-400 hover:text-white"}`}>
                    ₹{(m/1000).toFixed(0)}k
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress bar */}
      <Card className="bg-white/10 border-white/10 rounded-3xl mb-8">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white font-bold text-lg">Progress to Goal</span>
            <span className={`text-2xl font-black ${progress >= 100 ? "text-green-400" : "text-purple-300"}`}>{progress.toFixed(1)}%</span>
          </div>
          <div className="h-5 bg-white/10 rounded-full overflow-hidden mb-2">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width:`${progress}%`, background: progress >= 100
                ? "linear-gradient(to right,#22c55e,#4ade80)"
                : "linear-gradient(to right,#9333ea,#ec4899)" }} />
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>₹0</span>
            <span className="text-purple-300 font-semibold">Current: ₹{Math.round(monthly).toLocaleString()}/mo</span>
            <span>₹{goal.toLocaleString()}</span>
          </div>
          {progress >= 100 && <p className="text-green-400 font-bold text-center mt-3">🎉 Goal achieved! Consider raising your target.</p>}
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<IndianRupee size={14} />} label="Monthly Income Now"       value={`₹${Math.round(monthly).toLocaleString()}`}      color="text-green-400" />
        <StatCard icon={<Target size={14} />}       label="Monthly Gap"              value={`₹${Math.round(gap).toLocaleString()}`}           color={gap > 0 ? "text-orange-400" : "text-green-400"} sub={gap > 0 ? "to reach goal" : "Goal achieved!"} />
        <StatCard icon={<TrendingUp size={14} />}   label="Portfolio Div Yield"      value={`${(avgYield*100).toFixed(2)}%`}                  color="text-blue-400" sub="avg annual" />
        <StatCard icon={<Zap size={14} />}          label="Investment Needed"        value={`₹${Math.round(investNeeded).toLocaleString()}`}  color="text-yellow-400" sub={`at ${(avgYield*100).toFixed(1)}% yield`} />
      </div>

      {/* Milestones */}
      <Card className="bg-white/10 border-white/10 rounded-3xl mb-8">
        <CardContent className="p-6">
          <h3 className="text-white font-bold mb-5">🏆 Milestone Tracker</h3>
          <div className="space-y-3">
            {MILESTONES.map((m) => {
              const p = Math.min((monthly / m) * 100, 100);
              const done = monthly >= m;
              return (
                <div key={m}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={`font-semibold ${done ? "text-green-400" : "text-slate-300"}`}>{done ? "✅" : "🎯"} ₹{(m/1000).toFixed(0)}k / month</span>
                    <span className="text-slate-400">{p.toFixed(0)}%{!done && ` · ₹${Math.round(m-monthly).toLocaleString()} to go`}</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width:`${p}%`, background: done ? "#22c55e" : "linear-gradient(to right,#9333ea,#ec4899)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {nextM && (
        <Card className="bg-gradient-to-r from-blue-900/30 to-cyan-900/20 border-blue-500/30 rounded-3xl">
          <CardContent className="p-6 flex flex-wrap items-center gap-6">
            <div className="text-4xl">🚀</div>
            <div>
              <p className="text-white font-bold text-lg">Next milestone: ₹{(nextM/1000).toFixed(0)}k / month</p>
              <p className="text-slate-400 text-sm mt-1">
                Need <span className="text-cyan-400 font-bold">₹{Math.round(nextM-monthly).toLocaleString()}/mo more</span> — invest approx.
                <span className="text-yellow-400 font-bold"> ₹{avgYield > 0 ? Math.round((nextM-monthly)*12/avgYield).toLocaleString() : "—"}</span> at <span className="text-blue-400 font-bold">{(avgYield*100).toFixed(1)}%</span> yield.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
