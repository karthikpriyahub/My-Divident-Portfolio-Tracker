import React, { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, TrendingUp,
  BarChart3, Database, Calendar, Zap, Target, BookOpen } from "lucide-react";
import api, { EMPTY_FORM } from "./utils.jsx";
import PortfolioView        from "./PortfolioView.jsx";
import { ChartsView, DataStoreView } from "./AnalyticsViews.jsx";
import { QuickUpdateView, GoalView } from "./DashboardViews.jsx";
import CalendarView          from "./CalendarView.jsx";
import DividendTrackerView   from "./DividendTrackerView.jsx";

// ── Nav tabs ──────────────────────────────────────────────────────────────────

const TABS = [
  { id:"portfolio",   label:"Portfolio",    icon: TrendingUp },
  { id:"charts",      label:"Charts",       icon: BarChart3  },
  { id:"calendar",    label:"Div Calendar", icon: Calendar   },
  { id:"quickupdate", label:"Quick Update", icon: Zap        },
  { id:"goal",        label:"Income Goal",  icon: Target     },
  { id:"divtracker",  label:"Div Tracker",  icon: BookOpen   },
  { id:"datastore",   label:"Excel Store",  icon: Database   },
];

// ── Root App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = useState("portfolio");
  const [stocks,    setStocks]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [toast,     setToast]     = useState({ show:false, message:"", ok:true });
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [editIndex, setEditIndex] = useState(null);

  // ── data ──────────────────────────────────────────────────────────────────

  const loadPortfolio = useCallback(async () => {
    setLoading(true);
    try   { setStocks(await api.load()); }
    catch { showToast("Cannot reach API server on port 3001.", false); }
    finally { setLoading(false); }
  }, []);

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
    if (!window.confirm(`Remove "${stocks[idx]?.name}"?`)) return;
    setSaving(true);
    try   { setStocks(await api.remove(idx)); showToast("Stock removed."); }
    catch { showToast("Delete failed.", false); }
    finally { setSaving(false); }
  };

  // ── byType breakdown ──────────────────────────────────────────────────────

  const byType = ["Equity","REIT","InvIT"].map((t) => {
    const grp = stocks.filter((s) => s.type === t);
    return {
      type:t, count:grp.length,
      investment: grp.reduce((s,x) => s + x.qty*x.avgPrice,     0),
      currentVal: grp.reduce((s,x) => s + x.qty*x.currentPrice, 0),
      pnl:        grp.reduce((s,x) => s + (x.qty*x.currentPrice - x.qty*x.avgPrice), 0),
      grossDiv:   grp.reduce((s,x) => s + (x.divQty||x.qty)*x.dividend, 0),
    };
  });

  // ── render ────────────────────────────────────────────────────────────────

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

      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur border-b border-white/10 px-4">
        <div className="max-w-[98%] mx-auto flex items-center gap-1 h-14 overflow-x-auto">
          <span className="text-green-400 font-bold text-base mr-4 flex items-center gap-2 flex-shrink-0">
            <TrendingUp size={18} /> Dividend Tracker
          </span>
          {TABS.map(({ id, label, icon:Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-4 text-xs font-semibold border-b-2 transition-colors flex-shrink-0
                ${activeTab === id ? "border-green-400 text-green-400" : "border-transparent text-slate-400 hover:text-white"}`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Page content */}
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
            {activeTab === "calendar"    && <CalendarView />}
            {activeTab === "quickupdate" && <QuickUpdateView stocks={stocks} onStocksChange={setStocks} showToast={showToast} />}
            {activeTab === "goal"        && <GoalView stocks={stocks} />}
            {activeTab === "divtracker"  && <DividendTrackerView stocks={stocks} showToast={showToast} />}
            {activeTab === "datastore"   && (
              <DataStoreView stocks={stocks} onRefresh={loadPortfolio} showToast={showToast}
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
    </div>
  );
}
