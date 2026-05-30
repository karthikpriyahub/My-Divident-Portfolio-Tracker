import React, { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, TrendingUp,
  BarChart3, Database, Target, BookOpen, BarChart2, Home } from "lucide-react";
import api, { EMPTY_FORM } from "./utils.jsx";
import Login, { useAuth }          from "./Login.jsx";
import PortfolioView        from "./PortfolioView.jsx";
import { ChartsView, DataStoreView } from "./AnalyticsViews.jsx";
import { GoalView } from "./DashboardViews.jsx";
import DividendTrackerView   from "./DividendTrackerView.jsx";
import YearSummaryView       from "./YearSummaryView.jsx";
import BudgetTrackerView     from "./BudgetTrackerView.jsx";

const DIV_TABS = [
  { id:"portfolio",   label:"Portfolio",    icon: TrendingUp },
  { id:"charts",      label:"Charts",       icon: BarChart3  },
  { id:"yearsummary", label:"Year Summary", icon: BarChart2  },
  { id:"goal",        label:"Income Goal",  icon: Target     },
  { id:"divtracker",  label:"Div Tracker",  icon: BookOpen   },
  { id:"datastore",   label:"Excel Store",  icon: Database   },
];

// ── Home screen ───────────────────────────────────────────────────────────
function HomeScreen({ onSelect, onLogout, stocks }) {
  const [budgetMonth, setBudgetMonth] = React.useState(null);

  // fetch current month's budget for the balance card
  React.useEffect(() => {
    const yr = new Date().getFullYear();
    const mo = new Date().getMonth() + 1;
    fetch(`/api/budget/${yr}`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        const entry = data.find(e => Number(e.month) === mo);
        setBudgetMonth(entry || null);
      })
      .catch(() => {});
  }, []);

  // ── derived numbers ──────────────────────────────────────────────────────
  const totalInvested = stocks.reduce((s, x) => s + (x.qty * x.avgPrice),     0);
  const currentValue  = stocks.reduce((s, x) => s + (x.qty * x.currentPrice), 0);
  const totalDivs     = stocks.reduce((s, x) => s + (Number(x.dividend) || 0), 0);
  const pnl           = currentValue - totalInvested;
  const pnlPos        = pnl >= 0;

  const BUDGET_INCOME_KEYS  = ["income1","income2","income_other"];
  const BUDGET_OUT_KEYS     = ["house_expenses","chennai_rent","nainika_po","iob_expense","emi","mobile_recharge",
                               "po_my_account","canara_amma","po_wife_account",
                               "ppf","lic1","lic2","mf_sip","dividend_stocks"];
  const monthIncome  = budgetMonth ? BUDGET_INCOME_KEYS.reduce((t,k) => t + (Number(budgetMonth[k])||0), 0) : null;
  const monthOut     = budgetMonth ? BUDGET_OUT_KEYS.reduce((t,k)   => t + (Number(budgetMonth[k])||0), 0) : null;
  const monthBalance = monthIncome !== null ? monthIncome - monthOut : null;

  const fmt    = n  => `₹${Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:0,maximumFractionDigits:0})}`;
  const fmtPct = n  => `${n >= 0 ? "+" : ""}${Number(n).toFixed(2)}%`;
  const mo     = new Date().toLocaleString("default",{ month:"long" });

  const CARDS = [
    { label:"Total Invested",     value: fmt(totalInvested), color:"text-blue-400",   icon:"💳", show: totalInvested > 0 },
    { label:"Current Value",      value: fmt(currentValue),  color:"text-emerald-400",icon:"📈", show: currentValue > 0  },
    { label:"P&L",                value: fmt(pnl),           color: pnlPos ? "text-green-400" : "text-red-400", icon: pnlPos ? "🔝" : "🔞",
      sub: totalInvested > 0 ? fmtPct((pnl/totalInvested)*100) : null, show: currentValue > 0 },
    { label:"Total Dividends",    value: fmt(totalDivs),     color:"text-yellow-400", icon:"💸", show: totalDivs > 0     },
    { label:`${mo} Balance`,      value: monthBalance !== null ? fmt(monthBalance) : "—",
      color: monthBalance !== null ? (monthBalance >= 0 ? "text-green-400" : "text-red-400") : "text-slate-500",
      icon:"💰", show: true },
  ];

  const apps = [
    {
      id: "dividend",
      icon: "📈",
      title: "Dividend Tracker",
      desc: "Portfolio · P&L · Dividend income · Year summaries · Income goals",
      gradient: "from-emerald-500 to-teal-500",
      ring: "ring-emerald-500/40",
    },
    {
      id: "budget",
      icon: "💰",
      title: "Monthly Budget Tracker",
      desc: "Income · Expenses · Savings · Investments · Monthly balance",
      gradient: "from-blue-500 to-purple-500",
      ring: "ring-blue-500/40",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🪺</span>
          <span className="text-xl font-black tracking-tight text-white">FinNest</span>
        </div>
        <button onClick={onLogout}
          className="text-xs text-slate-500 hover:text-slate-300 transition px-3 py-1.5 rounded-lg hover:bg-white/10">
          Logout
        </button>
      </div>

      {/* Hero */}
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-10">
        <p className="text-slate-500 text-sm uppercase tracking-widest mb-2">Welcome back</p>
        <h1 className="text-5xl font-black text-white mb-2 tracking-tight">Your FinNest</h1>
        <p className="text-slate-400 mb-8 text-center max-w-md">
          One place for your investments, dividends, and monthly budget.
        </p>

        {/* ── Overall summary cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 w-full max-w-4xl mb-10">
          {CARDS.map(({ label, value, color, icon, sub, show }) => show && (
            <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-xl mb-1">{icon}</p>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
              {sub && <p className={`text-xs mt-0.5 ${color} opacity-80`}>{sub}</p>}
            </div>
          ))}
        </div>

        {/* ── App cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
          {apps.map(app => (
            <motion.button key={app.id}
              whileHover={{ scale: 1.03, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(app.id)}
              className={`ring-1 ${app.ring} bg-white/5 hover:bg-white/10 rounded-3xl p-8 text-left transition-all shadow-2xl`}>
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${app.gradient} flex items-center justify-center text-2xl mb-5 shadow-lg`}>
                {app.icon}
              </div>
              <h2 className="text-xl font-bold text-white mb-2">{app.title}</h2>
              <p className="text-slate-400 text-sm leading-relaxed">{app.desc}</p>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────

export default function App() {
  const { authed, login, logout } = useAuth();
  const [activeApp, setActiveApp] = useState(null);  // null=home | "dividend" | "budget"
  const [activeTab, setActiveTab] = useState("portfolio");
  const [stocks,    setStocks]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [toast,     setToast]     = useState({ show:false, message:"", ok:true });
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [editIndex, setEditIndex] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);   // bump to force all tabs to re-fetch

  // ── data ──────────────────────────────────────────────────────────────────

  const loadPortfolio = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.load();
      setStocks(Array.isArray(data) ? data : []);  // guard: never set non-array
    }
    catch { showToast("Cannot reach API server on port 3001.", false); }
    finally { setLoading(false); }
  }, []);

  // Refresh everything — portfolio + signal all tabs to re-fetch dividends
  const refreshAll = useCallback(async () => {
    await loadPortfolio();
    setRefreshKey((k) => k + 1);
  }, [loadPortfolio]);

  useEffect(() => { loadPortfolio(); }, [loadPortfolio]);

  // ── toast ─────────────────────────────────────────────────────────────────

  const showToast = (message, ok = true) => {
    setToast({ show:true, message, ok });
    setTimeout(() => setToast((t) => ({ ...t, show:false })), 2800);
  };

  // ── form helpers ──────────────────────────────────────────────────────────

  const openForm = (stock = null, idx = null) => {
    setForm(stock
      ? { name:stock.name, type:stock.type??"Equity", qty:stock.qty,
          divQty:stock.divQty||"",
          avgPrice:stock.avgPrice, currentPrice:stock.currentPrice,
          dividend:stock.dividend, netDividend:stock.netDividend??"",
          sector:stock.sector??"" }
      : EMPTY_FORM);
    setEditIndex(idx);
    setShowForm(true);
    setTimeout(() => document.getElementById("stock-form-section")
      ?.scrollIntoView({ behavior:"smooth", block:"start" }), 50);
  };

  const closeForm = () => {
    setShowForm(false); setEditIndex(null); setForm(EMPTY_FORM);
  };

  const handleField = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  // ── CRUD ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, qty, avgPrice, currentPrice } = form;
    if (!name.trim() || !qty || !avgPrice || !currentPrice) {
      showToast("Name, Qty, Avg Price and Current Price are required.", false);
      return;
    }
    const payload = {
      name:name.trim(), type:form.type||"Equity",
      qty:Number(form.qty), divQty:Number(form.divQty||form.qty||0),
      avgPrice:Number(form.avgPrice),
      currentPrice:Number(form.currentPrice),
      dividend:Number(form.dividend||0), netDividend:Number(form.netDividend||0),
      sector:(form.sector||"").trim(),
    };
    setSaving(true);
    try {
      setStocks(editIndex !== null
        ? await api.update(editIndex, payload)
        : await api.add(payload));
      showToast(editIndex !== null ? "Stock updated!" : "Stock added & saved to Excel!");
      closeForm();
    } catch { showToast("Save failed. Check the API server.", false); }
    finally   { setSaving(false); }
  };

  const handleDelete = async (idx) => {
    const stock = stocks[idx];
    if (!window.confirm(`Remove "${stock?.name}"?`)) return;
    setSaving(true);
    try   { setStocks(await api.remove(idx, stock?.name)); showToast("Stock removed."); }
    catch { showToast("Delete failed.", false); }
    finally { setSaving(false); }
  };

  // ── byType breakdown ──────────────────────────────────────────────────────

  const byType = ["Equity","REIT","InvIT"].map((t) => {
    const grp = stocks.filter((s) => s.type === t);
    return {
      type:t, count:grp.length,
      investment: grp.reduce((s,x) => s + x.qty*x.avgPrice,          0),
      currentVal: grp.reduce((s,x) => s + x.qty*x.currentPrice,      0),
      pnl:        grp.reduce((s,x) => s + (x.qty*x.currentPrice - x.qty*x.avgPrice), 0),
      grossDiv:   grp.reduce((s,x) => s + (Number(x.dividend) || 0), 0), // already totals
    };
  });

  // ── render ───────────────────────────────────────────────────────────────

  if (!authed) return <Login onLogin={login} />;
  if (!activeApp) return <HomeScreen onSelect={setActiveApp} onLogout={logout} stocks={stocks} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white">

      {/* Toast */}
      <AnimatePresence>
        {toast.show && (
          <motion.div initial={{ opacity:0, y:-24 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-24 }}
            className={`fixed top-6 right-6 z-50 px-5 py-4 rounded-2xl shadow-2xl font-semibold text-sm border flex items-center gap-3
              ${toast.ok ? "bg-green-700 border-green-400" : "bg-red-700 border-red-400"}`}>
            {toast.ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />} {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Budget app — full page, own nav */}
      {activeApp === "budget" && (
        <div className="min-h-screen">
          <nav className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur border-b border-white/10 px-4">
            <div className="max-w-[98%] mx-auto flex items-center gap-3 h-14">
              <span className="text-lg mr-1">🪺</span>
              <span className="font-black text-white tracking-tight mr-4">FinNest</span>
              <button onClick={() => setActiveApp(null)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition">
                <Home size={13} /> Home
              </button>
              <span className="text-slate-600 text-xs">/ Monthly Budget</span>
            </div>
          </nav>
          <div className="max-w-[98%] mx-auto px-4 py-8">
            <BudgetTrackerView showToast={showToast} />
          </div>
        </div>
      )}

      {/* Dividend Tracker app */}
      {activeApp === "dividend" && (
        <>
          <nav className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur border-b border-white/10 px-4">
            <div className="max-w-[98%] mx-auto flex items-center gap-1 h-14 overflow-x-auto">
              <span className="text-lg mr-1">🪺</span>
              <span className="font-black text-white tracking-tight mr-3">FinNest</span>
              <button onClick={() => setActiveApp(null)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition flex-shrink-0 mr-2">
                <Home size={13} /> Home
              </button>
              {DIV_TABS.map(({ id, label, icon:Icon }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-1.5 px-4 py-4 text-xs font-semibold border-b-2 transition-colors flex-shrink-0
                    ${activeTab === id ? "border-green-400 text-green-400" : "border-transparent text-slate-400 hover:text-white"}`}>
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
          </nav>

          <div className="max-w-[98%] mx-auto px-4 py-8">
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                exit={{ opacity:0 }} transition={{ duration:0.15 }}>
                {activeTab === "portfolio"   && (
                  <PortfolioView
                    stocks={stocks} loading={loading} saving={saving} byType={byType}
                    showForm={showForm} form={form} editIndex={editIndex}
                    onOpenForm={openForm} onCloseForm={closeForm}
                    onFieldChange={handleField} onSubmit={handleSubmit}
                    onDelete={handleDelete} onRefresh={loadPortfolio}
                  />
                )}
                {activeTab === "charts"      && <ChartsView stocks={stocks} />}
                {activeTab === "yearsummary" && <YearSummaryView />}
                {activeTab === "goal"        && <GoalView stocks={stocks} />}
                {activeTab === "divtracker"  && <DividendTrackerView stocks={stocks} showToast={showToast} refreshKey={refreshKey} />}
                {activeTab === "datastore"   && (
                  <DataStoreView stocks={stocks} onRefresh={loadPortfolio}
                    onStocksChange={setStocks} onRefreshAll={refreshAll} showToast={showToast}
                    onClearAll={async () => {
                      if (!window.confirm("Delete ALL records from portfolio.xlsx?")) return;
                      try   { setStocks(await api.clearAll()); showToast("All records cleared."); }
                      catch { showToast("Clear failed.", false); }
                    }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}
