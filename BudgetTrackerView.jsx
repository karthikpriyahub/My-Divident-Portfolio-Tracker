import React, { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Card, CardContent, Button, Input } from "./utils.jsx";
import { MONTH_NAMES } from "./utils.jsx";
import { Loader2, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Save } from "lucide-react";

// ── Field definitions ─────────────────────────────────────────────────────────

const INCOME_FIELDS = [
  { key: "income1",      label: "Income Source 1" },
  { key: "income2",      label: "Income Source 2" },
  { key: "income_other", label: "Other Income"    },
];

const EXPENSE_SECTIONS = [
  {
    key: "expenses", label: "🏠 Monthly Expenses", color: "red",
    ring: "ring-red-500/30", hdr: "bg-red-500/15 text-red-300",
    fields: [
      { key: "house_expenses",  label: "House Expenses"              },
      { key: "chennai_rent",    label: "Chennai Rent"                },
      { key: "nainika_po",      label: "Nainika PO Scheme"           },
      { key: "iob_expense",     label: "Monthly Expense to IOB Bank" },
      { key: "emi",             label: "EMI"                         },
      { key: "mobile_recharge", label: "Mobile Recharge"             },
    ],
  },
  {
    key: "savings", label: "🏦 Monthly Savings", color: "blue",
    ring: "ring-blue-500/30", hdr: "bg-blue-500/15 text-blue-300",
    fields: [
      { key: "po_my_account",   label: "Post Office – My Account"  },
      { key: "canara_amma",     label: "Canara – Amma Account"     },
      { key: "po_wife_account", label: "Post Office – Wife Account"},
    ],
  },
  {
    key: "investments", label: "📈 Investments", color: "purple",
    ring: "ring-purple-500/30", hdr: "bg-purple-500/15 text-purple-300",
    fields: [
      { key: "ppf",             label: "PPF"             },
      { key: "lic1",            label: "LIC – 1"         },
      { key: "lic2",            label: "LIC – 2"         },
      { key: "mf_sip",          label: "MF SIP"          },
      { key: "dividend_stocks", label: "Dividend Stocks" },
    ],
  },
];

const INCOME_KEYS   = INCOME_FIELDS.map(f => f.key);
const EXPENSE_KEYS  = EXPENSE_SECTIONS.flatMap(s => s.fields.map(f => f.key));
const ALL_KEYS      = [...INCOME_KEYS, ...EXPENSE_KEYS];
const TEXT_KEYS     = ["mobile_who", "mobile_when"];   // non-numeric extras
const EMPTY         = Object.fromEntries([...ALL_KEYS, ...TEXT_KEYS].map(k => [k, ""]));

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt  = n  => `₹${Number(n||0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtD = n  => `₹${Number(n||0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const sumK = (obj, keys) => keys.reduce((t, k) => t + (Number(obj?.[k]) || 0), 0);

// ── API ───────────────────────────────────────────────────────────────────────

const api = {
  loadPlan:    yr   => fetch(`/api/budget-plan/${yr}`).then(r => r.json()),
  savePlan:    body => fetch("/api/budget-plan", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) }).then(r => r.json()),
  loadMonths:  yr   => fetch(`/api/budget/${yr}`).then(r => r.json()),
  saveMonth:   body => fetch("/api/budget",    { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) }).then(r => r.json()),
  deleteMonth: id   => fetch(`/api/budget/${id}`, { method:"DELETE" }).then(r => r.json()),
};

const START_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => START_YEAR - 1 + i);

// ══════════════════════════════════════════════════════════════════════════════
// Tab 1 — Budget Plan
// ══════════════════════════════════════════════════════════════════════════════

function PlanTab({ year, showToast }) {
  const [plan,    setPlan]    = useState(null);
  const [form,    setForm]    = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.loadPlan(year);
      if (data && typeof data === "object" && !data.error) {
        setPlan(data);
        setForm(Object.fromEntries([...ALL_KEYS, ...TEXT_KEYS].map(k => [k, data[k] ?? ""])));
      } else { setPlan(null); setForm(EMPTY); }
    } catch { } finally { setLoading(false); }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const handleField = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSave = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        year,
        ...Object.fromEntries(ALL_KEYS.map(k => [k, Number(form[k]) || 0])),
        ...Object.fromEntries(TEXT_KEYS.map(k => [k, form[k] || ""])),
      };
      const saved = await api.savePlan(payload);
      if (saved && !saved.error) { setPlan(saved); showToast("Budget plan saved ✅"); }
      else showToast("Save failed — check Neon/VPN.", false);
    } catch { showToast("Save failed.", false); }
    finally { setSaving(false); }
  };

  const planIncome  = sumK(form, INCOME_KEYS);
  const planExpense = sumK(form, EXPENSE_KEYS);
  const planBalance = planIncome - planExpense;

  if (loading) return (
    <div className="flex items-center gap-3 justify-center py-20 text-slate-400">
      <Loader2 size={22} className="animate-spin" /> Loading plan…
    </div>
  );

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Live summary bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Expected Income",  value: planIncome,  color: "text-emerald-400" },
          { label: "Expected Outflow", value: planExpense, color: "text-red-400"     },
          { label: "Expected Balance", value: planBalance, color: planBalance >= 0 ? "text-green-400" : "text-red-500" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{fmt(value)}</p>
          </div>
        ))}
      </div>

      {/* Income section */}
      <div className="rounded-2xl ring-1 ring-emerald-500/30 overflow-hidden">
        <div className="bg-emerald-500/15 text-emerald-300 px-4 py-2 text-xs font-bold uppercase tracking-wider flex justify-between">
          <span>💰 Monthly Income (Expected)</span>
          <span>{fmt(planIncome)}</span>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {INCOME_FIELDS.map(f => (
            <div key={f.key}>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">{f.label}</label>
              <Input name={f.key} type="number" step="0.01" min="0" placeholder="0"
                value={form[f.key]} onChange={handleField}
                className="bg-slate-800 border border-slate-700 h-10 rounded-xl text-white text-sm px-3" />
            </div>
          ))}
        </div>
      </div>

      {/* Expense / Savings / Investments */}
      {EXPENSE_SECTIONS.map(section => (
        <div key={section.key} className={`rounded-2xl ring-1 ${section.ring} overflow-hidden`}>
          <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wider flex justify-between ${section.hdr}`}>
            <span>{section.label} (Expected)</span>
            <span>{fmt(sumK(form, section.fields.map(f => f.key)))}</span>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {section.fields.map(f => (
              <div key={f.key}>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">{f.label}</label>
                <Input name={f.key} type="number" step="0.01" min="0" placeholder="0"
                  value={form[f.key]} onChange={handleField}
                  className="bg-slate-800 border border-slate-700 h-10 rounded-xl text-white text-sm px-3" />
                {f.key === "mobile_recharge" && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] text-slate-500 uppercase tracking-wider mb-1 block">👤 Who</label>
                      <Input name="mobile_who" type="text" placeholder="Name"
                        value={form.mobile_who} onChange={handleField}
                        className="bg-slate-900/60 border border-slate-700 h-9 rounded-lg text-white text-xs px-2" />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 uppercase tracking-wider mb-1 block">📅 When</label>
                      <Input name="mobile_when" type="date"
                        value={form.mobile_when} onChange={handleField}
                        className="bg-slate-900/60 border border-slate-700 h-9 rounded-lg text-white text-xs px-2" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <Button type="submit" disabled={saving}
        className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {saving ? "Saving…" : `Save ${year} Budget Plan`}
      </Button>
    </form>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab 2 — Monthly Actual
// ══════════════════════════════════════════════════════════════════════════════

function ActualTab({ year, showToast }) {
  const [plan,    setPlan]    = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [modal,   setModal]   = useState(null);
  const [form,    setForm]    = useState(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [planData, monthData] = await Promise.all([api.loadPlan(year), api.loadMonths(year)]);
      setPlan(planData && !planData.error ? planData : null);
      setEntries(Array.isArray(monthData) ? monthData : []);
    } catch { } finally { setLoading(false); }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const entryFor  = m => entries.find(e => Number(e.month) === m) || null;
  const planIncome = plan ? sumK(plan, INCOME_KEYS) : 0;

  const openModal = m => {
    const e = entryFor(m);
    setForm(e
      ? Object.fromEntries([...ALL_KEYS, ...TEXT_KEYS].map(k => [k, e[k] ?? ""]))
      : { ...EMPTY });
    setModal({ month: m, id: e?.id ?? null });
  };
  const closeModal = () => { setModal(null); setForm(EMPTY); };

  const handleField = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSave = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.saveMonth({
        year, month: modal.month,
        ...Object.fromEntries(ALL_KEYS.map(k => [k, Number(form[k]) || 0])),
        ...Object.fromEntries(TEXT_KEYS.map(k => [k, form[k] || ""])),
      });
      await load(); showToast("Entry saved ✅"); closeModal();
    } catch { showToast("Save failed.", false); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, month) => {
    if (!window.confirm(`Clear ${MONTH_NAMES[month-1]} ${year} actual?`)) return;
    setSaving(true);
    try { await api.deleteMonth(id); await load(); showToast("Removed."); }
    catch { showToast("Delete failed.", false); }
    finally { setSaving(false); }
  };

  // Annual totals
  const annualActualExpense = entries.reduce((t, e) => t + sumK(e, EXPENSE_KEYS), 0);
  const annualPlanExpense   = plan ? sumK(plan, EXPENSE_KEYS) : 0;
  const monthsEntered       = entries.length;

  if (loading) return (
    <div className="flex items-center gap-3 justify-center py-20 text-slate-400">
      <Loader2 size={22} className="animate-spin" /> Loading actuals…
    </div>
  );

  return (
    <div>
      {/* Annual comparison cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Plan Income / mo",     value: fmt(planIncome),                     color: "text-emerald-400" },
          { label: "Plan Outflow / mo",    value: fmt(annualPlanExpense),              color: "text-slate-300"   },
          { label: `Actual Outflow (${monthsEntered}mo)`, value: fmt(annualActualExpense), color: "text-red-400" },
          { label: "Plan vs Actual",
            value: annualPlanExpense > 0
              ? `${(((annualActualExpense - annualPlanExpense) / annualPlanExpense) * 100).toFixed(1)}%`
              : "—",
            color: annualActualExpense <= annualPlanExpense ? "text-green-400" : "text-red-400",
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {!plan && (
        <div className="bg-yellow-900/30 border border-yellow-700/40 rounded-2xl px-5 py-4 mb-6 text-yellow-300 text-sm">
          ⚠️ No budget plan found for {year}. Set one in the <strong>Budget Plan</strong> tab first to enable income vs expense comparison.
        </div>
      )}

      {/* 12-month grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MONTH_NAMES.map((mName, mi) => {
          const m      = mi + 1;
          const entry  = entryFor(m);
          const actual = entry ? sumK(entry, EXPENSE_KEYS) : null;
          const planned = annualPlanExpense;
          const balance = planIncome && actual !== null ? planIncome - actual : null;
          const diff    = actual !== null && planned > 0 ? actual - planned : null;
          const over    = diff !== null && diff > 0;

          return (
            <Card key={m} className={`border rounded-2xl transition-all ${entry ? "bg-white/10 border-white/10" : "bg-white/3 border-white/5"}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className={`font-bold ${entry ? "text-white" : "text-slate-600"}`}>{mName} {year}</span>
                  <div className="flex gap-1">
                    <button onClick={() => openModal(m)}
                      className="p-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 transition">
                      {entry ? <Pencil size={13} /> : <Plus size={13} />}
                    </button>
                    {entry && (
                      <button onClick={() => handleDelete(entry.id, m)}
                        className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 transition">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {entry ? (
                  <div className="space-y-1.5 text-xs">
                    {/* Expense sections */}
                    {EXPENSE_SECTIONS.map(s => {
                      const v = sumK(entry, s.fields.map(f => f.key));
                      if (!v) return null;
                      const colorMap = { expenses:"text-red-400", savings:"text-blue-400", investments:"text-purple-400" };
                      return (
                        <div key={s.key}>
                          <div className="flex justify-between">
                            <span className="text-slate-400">{s.key === "expenses" ? "Expenses" : s.key === "savings" ? "Savings" : "Investments"}</span>
                            <span className={`font-semibold ${colorMap[s.key]}`}>{fmt(v)}</span>
                          </div>
                          {/* Mobile recharge sub-info */}
                          {s.key === "expenses" && (entry.mobile_who || entry.mobile_when) && (
                            <p className="text-[10px] text-slate-500 mt-0.5 ml-1">
                              📱 {entry.mobile_who || ""}{entry.mobile_who && entry.mobile_when ? " · " : ""}{entry.mobile_when || ""}
                            </p>
                          )}
                        </div>
                      );
                    })}

                    <div className="flex justify-between pt-1.5 border-t border-white/10">
                      <span className="text-slate-400 font-semibold">Total Outflow</span>
                      <span className="text-orange-400 font-bold">{fmt(actual)}</span>
                    </div>

                    {/* Compare with plan */}
                    {planIncome > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Plan Income</span>
                        <span className="text-emerald-400 font-semibold">{fmt(planIncome)}</span>
                      </div>
                    )}
                    {balance !== null && (
                      <div className={`flex justify-between pt-1.5 border-t border-white/10 font-bold`}>
                        <span className="text-white">Balance</span>
                        <span className={balance >= 0 ? "text-green-400" : "text-red-400"}>{fmt(balance)}</span>
                      </div>
                    )}
                    {diff !== null && (
                      <div className="mt-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${over ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                          {over ? `▲ Over plan by ${fmt(diff)}` : `✓ Under plan by ${fmt(Math.abs(diff))}`}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 italic">No entry — click + to add</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add / Edit Modal — expenses only */}
      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm px-4 py-6 overflow-y-auto"
            onClick={e => e.target === e.currentTarget && closeModal()}>
            <motion.div initial={{ scale:0.95, y:16 }} animate={{ scale:1, y:0 }} exit={{ scale:0.95, y:16 }}
              className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl p-6 my-auto">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-xl font-bold text-white">{modal.id ? "✏️ Edit Actual" : "➕ Add Actual"}</h3>
                  <p className="text-sm text-slate-400">{MONTH_NAMES[modal.month-1]} {year} — expenses only</p>
                </div>
                <button onClick={closeModal} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
              </div>

              <form onSubmit={handleSave} className="space-y-5">
                {EXPENSE_SECTIONS.map(section => (
                  <div key={section.key} className={`rounded-2xl ring-1 ${section.ring} overflow-hidden`}>
                    <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wider flex justify-between ${section.hdr}`}>
                      <span>{section.label}</span>
                      <span>{fmtD(sumK(form, section.fields.map(f => f.key)))}</span>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {section.fields.map(f => (
                        <div key={f.key}>
                          <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">{f.label}</label>
                          <Input name={f.key} type="number" step="0.01" min="0" placeholder="0.00"
                            value={form[f.key]} onChange={handleField}
                            className="bg-slate-800 border border-slate-700 h-10 rounded-xl text-white text-sm px-3" />
                          {f.key === "mobile_recharge" && (
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] text-slate-500 uppercase tracking-wider mb-1 block">👤 Who</label>
                                <Input name="mobile_who" type="text" placeholder="Name"
                                  value={form.mobile_who} onChange={handleField}
                                  className="bg-slate-900/60 border border-slate-700 h-9 rounded-lg text-white text-xs px-2" />
                              </div>
                              <div>
                                <label className="text-[9px] text-slate-500 uppercase tracking-wider mb-1 block">📅 When</label>
                                <Input name="mobile_when" type="date"
                                  value={form.mobile_when} onChange={handleField}
                                  className="bg-slate-900/60 border border-slate-700 h-9 rounded-lg text-white text-xs px-2" />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Live comparison */}
                <div className="bg-white/5 rounded-2xl p-4 grid grid-cols-3 gap-3 text-center text-xs">
                  {[
                    { label:"Plan Income",   val: planIncome,                                       color:"text-emerald-400" },
                    { label:"Actual Outflow",val: sumK(form, EXPENSE_KEYS),                        color:"text-red-400"     },
                    { label:"Balance",       val: planIncome - sumK(form, EXPENSE_KEYS),
                      color: (planIncome - sumK(form, EXPENSE_KEYS)) >= 0 ? "text-green-400" : "text-red-500" },
                  ].map(({ label, val, color }) => (
                    <div key={label}>
                      <p className="text-slate-500 mb-0.5">{label}</p>
                      <p className={`font-bold text-sm ${color}`}>{fmtD(val)}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-1">
                  <Button type="submit" disabled={saving}
                    className="flex-1 h-11 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                    {saving && <Loader2 size={14} className="animate-spin" />}
                    {modal.id ? "Update" : "Save"}
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

// ══════════════════════════════════════════════════════════════════════════════
// Root component
// ══════════════════════════════════════════════════════════════════════════════

export default function BudgetTrackerView({ showToast }) {
  const [tab,  setTab]  = useState("plan");
  const [year, setYear] = useState(START_YEAR);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-1">
            💰 Monthly Budget Tracker
          </h2>
          <p className="text-slate-400 text-sm">Plan your budget · Track actuals · Compare month by month</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setYear(y => Math.max(YEARS[0], y-1))}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
            <ChevronLeft size={18} />
          </button>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="bg-slate-900 border border-slate-700 text-white font-bold text-lg px-4 py-2 rounded-xl">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => setYear(y => Math.min(YEARS[YEARS.length-1], y+1))}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 border border-white/10 rounded-2xl p-1 mb-8 w-fit">
        {[
          { id:"plan",   label:"📋 Budget Plan"   },
          { id:"actual", label:"📊 Monthly Actual" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === t.id
                ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }} transition={{ duration:0.15 }}>
          {tab === "plan"   && <PlanTab   year={year} showToast={showToast} />}
          {tab === "actual" && <ActualTab year={year} showToast={showToast} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
