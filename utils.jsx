import React from "react";

// ── API helpers ───────────────────────────────────────────────────────────────

const json = (r) => r.json();

const api = {
  load:       ()           => fetch("/api/portfolio").then(json),
  meta:       ()           => fetch("/api/portfolio/meta").then(json),
  add:        (s)          => fetch("/api/portfolio", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(s) }).then(json),
  update:     (idx, s)     => fetch(`/api/portfolio/${idx}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(s) }).then(json),
  bulkUpdate: (stocks)     => fetch("/api/portfolio", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(stocks) }).then(json),
  remove:     (idx)        => fetch(`/api/portfolio/${idx}`, { method:"DELETE" }).then(json),
  clearAll:   ()           => fetch("/api/portfolio", { method:"DELETE" }).then(json),
};

export default api;

// ── Constants ─────────────────────────────────────────────────────────────────

export const STOCK_TYPES = ["Equity", "REIT", "InvIT"];

export const TYPE_COLOR = {
  Equity: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  REIT:   "bg-purple-500/20 text-purple-300 border-purple-500/30",
  InvIT:  "bg-orange-500/20 text-orange-300 border-orange-500/30",
};

export const TYPE_CHART_COLOR = {
  Equity: "#60a5fa",
  REIT:   "#c084fc",
  InvIT:  "#fb923c",
};

export const EMPTY_FORM = {
  name:"", type:"Equity", qty:"", divQty:"", avgPrice:"",
  currentPrice:"", dividend:"", netDividend:"", sector:"", symbol:"",
};

export const MONTH_NAMES = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

export const START_YEAR = new Date().getFullYear();
export const YEARS = Array.from({ length: 15 }, (_, i) => START_YEAR + i);

// ── Calculation helpers ───────────────────────────────────────────────────────

export function calcStock(s) {
  const inv      = s.qty * s.avgPrice;
  const cur      = s.qty * s.currentPrice;
  const pnl      = cur - inv;
  const divQty   = s.divQty || s.qty;          // use divQty if set, else fall back to qty
  const gross    = divQty * s.dividend;
  const net      = s.netDividend ?? 0;
  const tdsAmt   = gross - net;
  const tdsPct   = gross > 0 ? (tdsAmt / gross) * 100 : 0;
  const retPct   = inv   > 0 ? (pnl    / inv)   * 100 : 0;
  const yieldPct = inv   > 0 ? (gross  / inv)   * 100 : 0;
  const overall  = pnl + net;
  return { ...s, inv, cur, pnl, gross, net, tdsAmt, tdsPct, retPct, yieldPct, overall };
}

export function divMonths(type) {
  return type === "Equity" ? [3] : [3, 6, 9, 12];
}

// ── UI primitives ─────────────────────────────────────────────────────────────

export function Button({ className = "", children, onClick, type = "button", disabled, ...props }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center cursor-pointer transition-opacity disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}>
      {children}
    </button>
  );
}

export function Card({ className = "", children, ...props }) {
  return (
    <div className={`rounded-2xl border border-white/10 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardContent({ className = "", children, ...props }) {
  return <div className={className} {...props}>{children}</div>;
}

export function Input({ className = "", ...props }) {
  return (
    <input className={`w-full outline-none placeholder:text-slate-500 ${className}`} {...props} />
  );
}

// ── Shared SummaryCard ────────────────────────────────────────────────────────

const COLOR_MAP = {
  cyan:"text-cyan-400", green:"text-green-400", blue:"text-blue-400",
  yellow:"text-yellow-400", orange:"text-orange-400",
  emerald:"text-emerald-400", purple:"text-purple-400",
};

export function SummaryCard({ color, icon, label, value, sub, positive }) {
  const col = COLOR_MAP[color] ?? "text-white";
  const vc  = positive === undefined ? col : positive ? "text-green-400" : "text-red-400";
  return (
    <Card className="bg-white/10 border-white/10 backdrop-blur-xl rounded-3xl shadow-2xl">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-3">
          <span className={col}>{React.cloneElement(icon, { size: 20 })}</span>
          <span className={`text-sm font-bold tracking-wide ${col}`}>{label}</span>
        </div>
        <h2 className={`text-3xl font-bold ${vc}`}>{value}</h2>
        {sub && <p className="text-xs text-slate-400 mt-2">{sub}</p>}
      </CardContent>
    </Card>
  );
}
