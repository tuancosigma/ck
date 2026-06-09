"use client";

import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import {
  Cpu, Clock, RefreshCw, Server, Zap,
  CheckCircle2, Layers, AlertCircle,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "@/utils/api";
import { ChartTooltip } from "@/utils/helpers";



export default function ObservabilityPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchMetrics = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const data = await api.metrics.get();
      setMetrics(data);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.message || "Failed to load metrics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const t = setInterval(() => fetchMetrics(true), 15000);
    return () => clearInterval(t);
  }, [fetchMetrics]);

  const queue    = metrics?.queue || {};
  const execStats = metrics?.executions || {};
  const proc     = metrics?.process || {};
  const workflows = metrics?.workflows || {};
  const chart    = metrics?.chart?.hourly || [];

  const heapPct = proc.heapTotalMb > 0
    ? Math.round((proc.heapUsedMb / proc.heapTotalMb) * 100)
    : 0;
  const uptimeH = proc.uptimeSeconds ? (proc.uptimeSeconds / 3600).toFixed(1) : "0";
  const totalQ  = (queue.waiting || 0) + (queue.active || 0);

  const METRICS_CARDS = [
    { label: "Queue Depth",  value: totalQ,               suffix: "jobs",  icon: Layers, color: "text-primary",     sub: `${queue.active || 0} active` },
    { label: "Running Now",  value: execStats.running || 0, suffix: "",    icon: Zap,    color: "text-emerald-400", sub: `${execStats.queued || 0} queued` },
    { label: "Success Rate", value: `${execStats.successRate ?? 100}%`, suffix: "", icon: CheckCircle2, color: (execStats.successRate ?? 100) >= 90 ? "text-emerald-400" : "text-amber-400", sub: `${execStats.total || 0} total runs` },
    { label: "Heap Memory",  value: `${proc.heapUsedMb || 0}`, suffix: "MB", icon: Cpu, color: heapPct > 80 ? "text-amber-400" : "text-blue-400", sub: `${heapPct}% used` },
    { label: "Avg Duration", value: execStats.avgDurationMs > 1000 ? `${(execStats.avgDurationMs / 1000).toFixed(1)}s` : `${execStats.avgDurationMs || 0}ms`, suffix: "", icon: Clock, color: "text-amber-400", sub: "per execution" },
    { label: "API Uptime",   value: `${uptimeH}h`,        suffix: "",      icon: Server, color: "text-emerald-400", sub: "since last restart" },
  ];

  const QUEUE_BARS = [
    { label: "Active",    value: queue.active || 0,    color: "#34d399", max: Math.max(queue.active || 1, 10) },
    { label: "Waiting",   value: queue.waiting || 0,   color: "#60a5fa", max: Math.max(queue.waiting || 1, 10) },
    { label: "Completed", value: queue.completed || 0, color: "#F25E22", max: Math.max(queue.completed || 1, 100) },
    { label: "Failed",    value: queue.failed || 0,    color: "#f87171", max: Math.max(queue.failed || 1, 10) },
    { label: "Delayed",   value: queue.delayed || 0,   color: "#fbbf24", max: Math.max(queue.delayed || 1, 10) },
  ];

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
                <h1 className="text-xl font-black text-white tracking-tight">Observability</h1>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  Real-time cluster health, BullMQ queue depths, and process metrics.
                  <span className="text-slate-600 ml-2">Auto-refresh every 15s</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-600 font-bold">
                  Last: {lastRefresh.toLocaleTimeString()}
                </span>
                <button
                  onClick={() => fetchMetrics(true)}
                  disabled={refreshing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 hover:border-border bg-white/[0.03] hover:bg-white/[0.06] text-xs font-bold text-slate-300 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 text-sm text-red-300">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* KPI Cards */}
            <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {METRICS_CARDS.map(({ label, value, suffix, icon: Icon, color, sub }) => (
                <div key={label} className="stat-card p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">{label}</span>
                    <Icon className={`w-3.5 h-3.5 ${color} flex-shrink-0`} />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-xl font-black tabular ${loading ? "text-slate-600" : "text-white"}`}>
                      {loading ? "—" : value}
                    </span>
                    {suffix && <span className="text-[10px] text-slate-500 font-semibold">{suffix}</span>}
                  </div>
                  <span className={`text-[9px] font-semibold ${color}`}>{sub}</span>
                </div>
              ))}
            </section>

            {/* Charts Row */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Execution Chart */}
              <div className="glass-panel p-5 flex flex-col">
                <div className="section-header mb-4">
                  <div>
                    <h3 className="section-title">Executions — Last 7h</h3>
                    <p className="section-subtitle">Hourly volume from database</p>
                  </div>
                </div>
                <div className="flex-1 h-52">
                  {loading ? (
                    <div className="h-full skeleton rounded-xl" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gExec" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#F25E22" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#F25E22" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gFail2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f87171" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="time" stroke="transparent" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                        <YAxis stroke="transparent" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} allowDecimals={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Area type="monotone" dataKey="executions" name="Executions" stroke="#F25E22" strokeWidth={2} fill="url(#gExec)" />
                        <Area type="monotone" dataKey="failed"     name="Failed"     stroke="#f87171" strokeWidth={1.5} fill="url(#gFail2)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Queue Breakdown */}
              <div className="glass-panel p-5 flex flex-col">
                <div className="section-header mb-4">
                  <div>
                    <h3 className="section-title">BullMQ Queue State</h3>
                    <p className="section-subtitle">Live from Redis</p>
                  </div>
                  <span className="badge badge-success">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
                    LIVE
                  </span>
                </div>
                <div className="space-y-4 flex-1 flex flex-col justify-center">
                  {QUEUE_BARS.map(({ label, value, color, max }) => (
                    <div key={label} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-400">{label}</span>
                        <span className="text-white tabular font-bold">{loading ? "—" : value.toLocaleString()}</span>
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-bar-fill"
                          style={{
                            width: loading ? "0%" : `${Math.min(Math.round((value / max) * 100), 100)}%`,
                            background: color,
                            transition: "width 700ms ease",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Execution Status Summary */}
            <section className="glass-panel p-5">
              <div className="section-header mb-5">
                <div>
                  <h3 className="section-title">Execution Status Summary</h3>
                  <p className="section-subtitle">All-time totals from database</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 pulse-dot" />
                  <span className="text-[10px] text-emerald-400 font-bold">{workflows.active || 0} ACTIVE WORKFLOWS</span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {[
                  { label: "Total",    value: execStats.total   || 0, color: "text-white",       bg: "bg-white/[0.04]",          border: "border-white/[0.06]" },
                  { label: "Success",  value: execStats.success || 0, color: "text-emerald-400", bg: "bg-emerald-500/[0.05]",    border: "border-emerald-500/15" },
                  { label: "Failed",   value: execStats.failed  || 0, color: "text-red-400",     bg: "bg-red-500/[0.05]",        border: "border-red-500/15" },
                  { label: "Running",  value: execStats.running || 0, color: "text-blue-400",    bg: "bg-blue-500/[0.05]",       border: "border-blue-500/15" },
                  { label: "Queued",   value: execStats.queued  || 0, color: "text-amber-400",   bg: "bg-amber-500/[0.05]",      border: "border-amber-500/15" },
                ].map(({ label, value, color, bg, border }) => (
                  <div key={label} className={`${bg} border ${border} rounded-xl p-5 text-center`}>
                    <span className={`text-2xl font-black ${color} block tabular`}>
                      {loading ? "—" : value.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mt-1">{label}</span>
                  </div>
                ))}
              </div>
            </section>

          </div>
        </main>
      </div>
    </div>
  );
}
