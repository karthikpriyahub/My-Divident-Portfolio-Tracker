import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, MONTH_NAMES } from "./utils.jsx";
import { Chart, BarElement, CategoryScale, LinearScale,
         Tooltip, Legend, BarController } from "chart.js";

Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, BarController);

const COLOURS = { gross:"#facc15", tds:"#f87171", net:"#4ade80" };

export default function YearSummaryView() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const chartRef  = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setEntries(await fetch("/api/dividends").then((r) => r.json())); }
    catch { setEntries([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Group by year
  const yearMap = {};
  entries.forEach(({ year, grossDiv, tds, netDiv }) => {
    if (!yearMap[year]) yearMap[year] = { gross: 0, tds: 0, net: 0, count: 0 };
    yearMap[year].gross += Number(grossDiv || 0);
    yearMap[year].tds   += Number(tds      || 0);
    yearMap[year].net   += Number(netDiv   || 0);
    yearMap[year].count += 1;
  });

  const years     = Object.keys(yearMap).sort();
  const grossVals = years.map((y) => Number(yearMap[y].gross.toFixed(3)));
  const tdsVals   = years.map((y) => Number(yearMap[y].tds.toFixed(3)));
  const netVals   = years.map((y) => Number(yearMap[y].net.toFixed(3)));

  // Best year
  const bestYear = years.reduce((best, y) =>
    (yearMap[y].net > (yearMap[best]?.net ?? 0) ? y : best), years[0]);

  // Chart
  useEffect(() => {
    if (!chartRef.current || !years.length) return;
    const ch = new Chart(chartRef.current, {
      type: "bar",
      data: {
        labels: years,
        datasets: [
          { label: "Gross Div (₹)",  data: grossVals, backgroundColor: COLOURS.gross + "aa", borderColor: COLOURS.gross, borderWidth: 2 },
          { label: "TDS (₹)",        data: tdsVals,   backgroundColor: COLOURS.tds   + "aa", borderColor: COLOURS.tds,   borderWidth: 2 },
          { label: "Net Div (₹)",    data: netVals,   backgroundColor: COLOURS.net   + "aa", borderColor: COLOURS.net,   borderWidth: 2 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 20 } },
        scales: {
          x: { ticks: { color:"#94a3b8" }, grid: { color:"#ffffff10" } },
          y: { ticks: { color:"#94a3b8", callback: (v) => `₹${v.toLocaleString("en-IN")}` }, grid: { color:"#ffffff10" } },
        },
        plugins: {
          legend: { labels: { color:"#cbd5e1" } },
          tooltip: { callbacks: { label: (c) => ` ₹${Number(c.raw).toLocaleString("en-IN", { minimumFractionDigits:3 })}` } },
        },
      },
    });
    return () => ch.destroy();
  }, [JSON.stringify(years), JSON.stringify(grossVals)]);

  const fmt = (n) => Number(n).toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent mb-2">
          Year-wise Income Summary
        </h2>
        <p className="text-slate-400 text-sm">Annual dividend income — Gross, TDS deducted and Net received.</p>
      </div>

      {loading ? (
        <div className="text-center py-24 text-slate-400 animate-pulse">Loading…</div>
      ) : !years.length ? (
        <div className="text-center py-24 text-slate-500">
          <p className="text-5xl mb-4">📋</p>
          <p className="text-white font-semibold">No dividend entries yet.</p>
          <p className="text-sm mt-2">Add entries in the Div Tracker tab first.</p>
        </div>
      ) : (
        <>
          {/* Summary chips */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white/10 border-white/10 rounded-2xl">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-slate-400 mb-1">Total Years</p>
                <p className="text-2xl font-bold text-white">{years.length}</p>
              </CardContent>
            </Card>
            <Card className="bg-white/10 border-white/10 rounded-2xl">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-slate-400 mb-1">Best Year</p>
                <p className="text-2xl font-bold text-green-400">{bestYear}</p>
                <p className="text-xs text-slate-500">₹{fmt(yearMap[bestYear]?.net ?? 0)} net</p>
              </CardContent>
            </Card>
            <Card className="bg-white/10 border-white/10 rounded-2xl">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-slate-400 mb-1">Total Net Received</p>
                <p className="text-2xl font-bold text-emerald-400">
                  ₹{fmt(netVals.reduce((a, b) => a + b, 0))}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white/10 border-white/10 rounded-2xl">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-slate-400 mb-1">Total TDS Paid</p>
                <p className="text-2xl font-bold text-red-400">
                  ₹{fmt(tdsVals.reduce((a, b) => a + b, 0))}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Bar chart */}
          <Card className="bg-white/10 border-white/10 backdrop-blur-xl rounded-3xl shadow-2xl mb-6">
            <CardContent className="p-5">
              <p className="text-white font-bold mb-4">📊 Annual Dividend Income (₹)</p>
              <div style={{ position: "relative", height: 320 }}>
                <canvas ref={chartRef} />
              </div>
            </CardContent>
          </Card>

          {/* Year-wise table */}
          <Card className="bg-white/10 border-white/10 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden">
            <CardContent className="p-0">
              <div className="p-5 border-b border-white/10">
                <h3 className="text-base font-bold text-white">📋 Year-wise Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-white">
                  <thead className="bg-white/5 text-xs text-slate-400 uppercase tracking-wider">
                    <tr>
                      {["Year","Entries","Gross Div (₹)","TDS (₹)","Net Div (₹)","Growth"].map((h) => (
                        <th key={h} className="p-4 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {years.map((y, i) => {
                      const prev   = i > 0 ? yearMap[years[i - 1]].net : null;
                      const growth = prev ? (((yearMap[y].net - prev) / prev) * 100).toFixed(1) : null;
                      return (
                        <tr key={y} className={`border-b border-white/5 hover:bg-white/5 ${y === bestYear ? "bg-green-500/5" : ""}`}>
                          <td className="p-4 font-bold text-white">{y}{y === bestYear && <span className="ml-2 text-xs text-green-400">★ Best</span>}</td>
                          <td className="p-4 text-slate-400">{yearMap[y].count}</td>
                          <td className="p-4 text-yellow-400 font-semibold">₹{fmt(yearMap[y].gross)}</td>
                          <td className="p-4 text-red-400">₹{fmt(yearMap[y].tds)}</td>
                          <td className="p-4 text-emerald-400 font-bold">₹{fmt(yearMap[y].net)}</td>
                          <td className="p-4">
                            {growth !== null ? (
                              <span className={`font-bold ${Number(growth) >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {Number(growth) >= 0 ? "▲" : "▼"} {Math.abs(growth)}%
                              </span>
                            ) : <span className="text-slate-500">—</span>}
                          </td>
                        </tr>
                      );
                    })}
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
