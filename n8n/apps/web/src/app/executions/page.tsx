"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import {
  Activity, ChevronRight, XCircle, CheckCircle,
  Search, RefreshCw, ArrowUpDown, TrendingUp,
} from "lucide-react";
import { api } from "@/utils/api";
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";
import { timeAgo, ChartTooltip } from "@/utils/helpers";

const STATUS_BADGE: Record<string, string> = {
  SUCCESS: "badge-success",
  FAILED: "badge-error",
  CANCELLED: "badge-neutral",
  RUNNING: "badge-info",
  QUEUED: "badge-warning",
};

function fmt(d: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(d));
}


export default function ExecutionsPage() {
  const router = useRouter();
  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const [page, setPage] = useState(1);
  const PER_PAGE = 12;

  const fetchExecutions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.executions.list({ limit: 300 });
      setExecutions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchExecutions(); }, [fetchExecutions]);

  /* Stats */
  const totalExec   = executions.length;
  const successExec = executions.filter(e => e.status === "SUCCESS").length;
  const failedExec  = executions.filter(e => e.status === "FAILED").length;
  const runningExec = executions.filter(e => e.status === "RUNNING").length;
  const successRate = totalExec > 0 ? ((successExec / totalExec) * 100).toFixed(1) : "—";

  /* Real deltas: current 7 days vs prior 7 days */
  const now = Date.now();
  const curr7Start = now - 7 * 86400000;
  const prev7Start = now - 14 * 86400000;
  const curr7 = executions.filter(e => new Date(e.createdAt).getTime() >= curr7Start);
  const prev7 = executions.filter(e => {
    const t = new Date(e.createdAt).getTime();
    return t >= prev7Start && t < curr7Start;
  });
  const curr7Total   = curr7.length;
  const prev7Total   = prev7.length;
  const curr7Success = curr7.filter(e => e.status === "SUCCESS").length;
  const prev7Success = prev7.filter(e => e.status === "SUCCESS").length;
  const curr7Rate    = curr7Total > 0 ? (curr7Success / curr7Total) * 100 : 0;
  const prev7Rate    = prev7Total > 0 ? (prev7Success / prev7Total) * 100 : 0;
  function pctDelta(curr: number, prev: number): string {
    if (prev === 0) return curr > 0 ? "+100%" : "—";
    const d = ((curr - prev) / prev) * 100;
    return (d >= 0 ? "+" : "") + d.toFixed(1) + "%";
  }
  const deltaTotal   = pctDelta(curr7Total, prev7Total);
  const deltaSuccess = pctDelta(curr7Success, prev7Success);
  const deltaRate    = prev7Rate === 0 ? "—" : ((curr7Rate - prev7Rate) >= 0 ? "+" : "") + (curr7Rate - prev7Rate).toFixed(1) + "pp";

  /* Chart: last 7 days hourly buckets */
  const chartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const offset = 6 - i;
      const d = new Date(Date.now() - offset * 86400000);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const inDay = executions.filter(e => {
        const ed = new Date(e.createdAt);
        return ed.toDateString() === d.toDateString();
      });
      return {
        name: label,
        success: inDay.filter(e => e.status === "SUCCESS").length,
        failed: inDay.filter(e => e.status === "FAILED").length,
      };
    });
  }, [executions]);

  /* Filtered + sorted */
  const filtered = useMemo(() =>
    executions
      .filter(e =>
        (statusFilter === "ALL" || e.status === statusFilter) &&
        (e.workflow?.name ?? "").toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        const av = new Date(a.createdAt).getTime();
        const bv = new Date(b.createdAt).getTime();
        return sortDir === "desc" ? bv - av : av - bv;
      })
  , [executions, statusFilter, searchQuery, sortDir]);

  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  const STATUSES = ["ALL", "SUCCESS", "FAILED", "RUNNING", "QUEUED", "CANCELLED"];

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: "#0a0d14" }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto p-6 space-y-6">

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-black text-white tracking-tight">Execution History</h1>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  Review workflow runs, trace logs, and execution timelines.
                </p>
              </div>
              <button
                onClick={fetchExecutions}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 hover:border-border bg-white/[0.03] hover:bg-white/[0.06] text-xs font-bold text-slate-300 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            {/* KPI Strip */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total Runs", value: totalExec, icon: Activity, color: "text-primary", delta: deltaTotal },
                { label: "Successful", value: successExec, icon: CheckCircle, color: "text-emerald-400", delta: deltaSuccess },
                { label: "Failed", value: failedExec, icon: XCircle, color: "text-red-400", delta: pctDelta(curr7.filter(e => e.status === "FAILED").length, prev7.filter(e => e.status === "FAILED").length) },
                { label: "Success Rate", value: `${successRate}%`, icon: TrendingUp, color: "text-indigo-400", delta: deltaRate },
              ].map(({ label, value, icon: Icon, color, delta }) => (
                <div key={label} className="stat-card p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="text-2xl font-black text-white tabular">{loading ? "—" : value}</span>
                    <span className={`text-[10px] font-bold ${color}`}>{delta}</span>
                  </div>
                </div>
              ))}
            </section>

            {/* Chart */}
            <section className="glass-panel p-5">
              <div className="section-header mb-4">
                <div>
                  <h3 className="section-title">Execution Trend</h3>
                  <p className="section-subtitle">Last 7 days — success vs failures</p>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-bold">
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-primary/80" /><span className="text-slate-400">Success</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-red-400/80" /><span className="text-slate-400">Failed</span></div>
                </div>
              </div>
              <div className="h-44">
                {loading ? (
                  <div className="h-full skeleton rounded-xl" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="name" stroke="transparent" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                      <YAxis stroke="transparent" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="success" name="Success" fill="#F25E22" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="failed"  name="Failed"  fill="#f87171" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            {/* Table */}
            <section className="glass-panel p-5">
              <div className="section-header">
                <div>
                  <h3 className="section-title">Execution Log</h3>
                  <p className="section-subtitle">{filtered.length} records</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Status filter pills */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {STATUSES.map(s => (
                      <button
                        key={s}
                        onClick={() => { setStatusFilter(s); setPage(1); }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          statusFilter === s
                            ? "bg-primary text-white"
                            : "bg-white/[0.04] border border-border/60 text-slate-400 hover:text-white"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                      placeholder="Search workflow..."
                      className="pl-8 pr-3 py-1.5 text-[11px] bg-white/[0.04] border border-border/60 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-primary/40 transition-colors font-medium w-36"
                    />
                  </div>
                  <button
                    onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}
                    className="flex items-center gap-1 px-2.5 py-1.5 border border-border/60 rounded-lg text-[10px] font-bold text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    {sortDir === "desc" ? "Newest" : "Oldest"}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="text-left">Workflow</th>
                      <th>Status</th>
                      <th>Trigger</th>
                      <th className="text-right">Time</th>
                      <th className="text-right">Started</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? Array.from({ length: 8 }).map((_, i) => (
                          <tr key={i}>
                            {Array.from({ length: 6 }).map((_, j) => (
                              <td key={j}><div className="skeleton h-3.5 rounded w-full" /></td>
                            ))}
                          </tr>
                        ))
                      : paged.map(exec => (
                          <tr
                            key={exec.id}
                            className="cursor-pointer"
                            onClick={() => router.push(`/executions/${exec.id}`)}
                          >
                            <td>
                              <div className="font-semibold text-white truncate max-w-[200px] hover:text-primary transition-colors">
                                {exec.workflow?.name || "Unknown workflow"}
                              </div>
                              <div className="text-[10px] text-slate-600 font-mono truncate mt-0.5">
                                {exec.id}
                              </div>
                            </td>
                            <td>
                              <span className={`badge ${STATUS_BADGE[exec.status] || "badge-neutral"}`}>
                                {exec.status}
                              </span>
                            </td>
                            <td>
                              <span className="badge badge-neutral">{exec.triggerType || "manual"}</span>
                            </td>
                            <td className="text-right text-slate-500 text-[11px] font-medium">
                              {exec.finishedAt && exec.createdAt
                                ? `${Math.max(0, Math.round((new Date(exec.finishedAt).getTime() - new Date(exec.createdAt).getTime()) / 1000))}s`
                                : "—"}
                            </td>
                            <td className="text-right text-slate-500 text-[11px] font-medium whitespace-nowrap">
                              {timeAgo(exec.createdAt)}
                            </td>
                            <td className="text-right">
                              {exec.status === "FAILED"
                                ? <XCircle className="w-4 h-4 text-red-400 ml-auto" />
                                : <ChevronRight className="w-4 h-4 text-slate-600 ml-auto" />
                              }
                            </td>
                          </tr>
                        ))
                    }
                    {!loading && paged.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <Activity className="w-8 h-8 text-slate-700" />
                            <p className="text-slate-500 font-medium">No executions found</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-border/40">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1}
                      className="px-2.5 py-1 text-[10px] font-bold border border-border/60 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] disabled:opacity-30 transition-all">Prev</button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => setPage(p)}
                        className={`px-2.5 py-1 text-[10px] font-bold border rounded-lg transition-all ${page === p ? "bg-primary border-primary text-white" : "border-border/60 text-slate-400 hover:text-white hover:bg-white/[0.05]"}`}>
                        {p}
                      </button>
                    ))}
                    <button onClick={() => setPage(p => Math.min(p + 1, totalPages))} disabled={page === totalPages}
                      className="px-2.5 py-1 text-[10px] font-bold border border-border/60 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] disabled:opacity-30 transition-all">Next</button>
                  </div>
                </div>
              )}
            </section>

          </div>
        </main>
      </div>
    </div>
  );
}
