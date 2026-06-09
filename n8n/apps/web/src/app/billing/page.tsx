"use client";

import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import {
  CreditCard, TrendingUp, Zap, CheckCircle,
  DollarSign, Sparkles, Calendar, AlertCircle, BarChart2,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "@/utils/api";
import { ChartTooltip } from "@/utils/helpers";

const PLAN_EXEC_LIMIT = 100_000;
const COST_PER_EXEC   = 0.01;

const PLANS = [
  { name: "Starter",    price: "$29",  execs: "10K",  workflows: "10",  active: false },
  { name: "Pro",        price: "$99",  execs: "100K", workflows: "50",  active: true  },
  { name: "Enterprise", price: "$299", execs: "∞",    workflows: "∞",   active: false },
];



export default function BillingPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>(null);
  const [executions, setExecutions] = useState<any[]>([]);
  const [workspace, setWorkspace] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [metricsData, executionList, wsData] = await Promise.all([
        api.metrics.get(),
        api.executions.list({ limit: 300 }),
        api.workspace.get(),
      ]);
      setMetrics(metricsData);
      setExecutions(executionList);
      setWorkspace(wsData);
    } catch (err: any) {
      setError(err.message || "Failed to load billing data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* Build monthly chart data */
  const monthlyData = (() => {
    const map: Record<string, { month: string; executions: number; cost: number }> = {};
    for (const exec of executions) {
      const d = new Date(exec.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en-US", { month: "short", year: "2-digit" });
      if (!map[key]) map[key] = { month: label, executions: 0, cost: 0 };
      map[key].executions++;
      map[key].cost = parseFloat((map[key].executions * COST_PER_EXEC).toFixed(2));
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v).slice(-6);
  })();

  const totalExecs       = metrics?.executions?.total || 0;
  const execPct          = Math.min((totalExecs / PLAN_EXEC_LIMIT) * 100, 100);
  const totalCost        = parseFloat((totalExecs * COST_PER_EXEC).toFixed(2));
  const curMonth         = monthlyData[monthlyData.length - 1];
  const prevMonth        = monthlyData[monthlyData.length - 2];
  const costTrend        = curMonth && prevMonth
    ? ((curMonth.cost - prevMonth.cost) / Math.max(prevMonth.cost, 0.01) * 100).toFixed(1)
    : "0";
  const activeWfs        = metrics?.workflows?.active || 0;
  const successRate      = metrics?.executions?.successRate ?? 100;

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: "#0a0d14" }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto p-6 space-y-6">

            {/* Header */}
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">Usage &amp; Billing</h1>
              <p className="text-[12px] text-slate-500 mt-0.5">
                Real execution usage, cost estimates, and plan quota tracking.
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 text-sm text-red-300">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Top KPI Strip */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "This Month Cost",   value: `$${curMonth?.cost?.toFixed(2) || "0.00"}`,     icon: DollarSign, color: "text-primary",     delta: `${Number(costTrend) >= 0 ? "+" : ""}${costTrend}%` },
                { label: "This Month Runs",   value: (curMonth?.executions || 0).toLocaleString(),   icon: Zap,        color: "text-emerald-400", delta: "+8.4%" },
                { label: "All-time Cost",     value: `$${totalCost.toFixed(2)}`,                     icon: CreditCard, color: "text-indigo-400",  delta: `${totalExecs.toLocaleString()} execs` },
                { label: "Active Workflows",  value: activeWfs,                                       icon: BarChart2,  color: "text-amber-400",   delta: `${50 - activeWfs} remaining` },
              ].map(({ label, value, icon: Icon, color, delta }) => (
                <div key={label} className="stat-card p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                  </div>
                  <span className="text-2xl font-black text-white tabular block">
                    {loading ? "—" : value}
                  </span>
                  <span className={`text-[10px] font-bold mt-1 block ${color}`}>{delta}</span>
                </div>
              ))}
            </section>

            {/* Plan Selection */}
            <section>
              <h3 className="section-title mb-4">Current Plan</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {PLANS.map(plan => (
                  <div
                    key={plan.name}
                    className={`relative rounded-2xl border p-6 transition-all ${
                      plan.active
                        ? "border-primary/40 bg-primary/5 shadow-[0_0_0_1px_rgba(242,94,34,0.15),0_8px_30px_rgba(0,0,0,0.3)]"
                        : "border-border/50 bg-white/[0.02] hover:border-border hover:bg-white/[0.04]"
                    }`}
                  >
                    {plan.active && (
                      <div className="absolute top-4 right-4 badge badge-primary">
                        <Sparkles className="w-2.5 h-2.5" /> CURRENT
                      </div>
                    )}
                    <h4 className="text-sm font-black text-white mb-1">{plan.name}</h4>
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-3xl font-black text-white tabular">{plan.price}</span>
                      <span className="text-slate-500 text-xs font-semibold">/month</span>
                    </div>
                    <div className="space-y-2">
                      {[
                        `${plan.execs} executions/mo`,
                        `${plan.workflows} active workflows`,
                        "Unlimited credentials",
                        plan.name === "Enterprise" ? "Priority support" : "Community support",
                      ].map(feature => (
                        <div key={feature} className="flex items-center gap-2 text-xs">
                          <CheckCircle className={`w-3.5 h-3.5 flex-shrink-0 ${plan.active ? "text-primary" : "text-slate-600"}`} />
                          <span className={plan.active ? "text-slate-300" : "text-slate-500"}>{feature}</span>
                        </div>
                      ))}
                    </div>
                    {!plan.active && (
                      <button className="mt-5 w-full py-2 text-[11px] font-bold border border-border/60 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.05] hover:border-border transition-all">
                        {plan.name === "Enterprise" ? "Contact Sales" : "Upgrade"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Quota Meters + Chart */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Quota Meters */}
              <div className="glass-panel p-5">
                <div className="section-header mb-5">
                  <div>
                    <h3 className="section-title">Plan Quota</h3>
                    <p className="section-subtitle">Usage vs. limits</p>
                  </div>
                </div>
                <div className="space-y-5">
                  {[
                    {
                      label: "Executions",
                      current: totalExecs,
                      max: PLAN_EXEC_LIMIT,
                      pct: execPct,
                      color: execPct > 80 ? "#fbbf24" : "#F25E22",
                      text: execPct > 80 ? "text-amber-400" : "text-primary",
                    },
                    {
                      label: "Active Workflows",
                      current: activeWfs,
                      max: 50,
                      pct: Math.min((activeWfs / 50) * 100, 100),
                      color: "#818cf8",
                      text: "text-indigo-400",
                    },
                    {
                      label: "Success Rate",
                      current: successRate,
                      max: 100,
                      pct: successRate,
                      color: successRate >= 90 ? "#34d399" : "#fbbf24",
                      text: successRate >= 90 ? "text-emerald-400" : "text-amber-400",
                      suffix: "%",
                    },
                  ].map(({ label, current, max, pct, color, text, suffix }) => (
                    <div key={label} className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-400">{label}</span>
                        <span className={text}>
                          {loading ? "—" : `${typeof current === "number" && !suffix ? current.toLocaleString() : current}${suffix || ""} / ${typeof max === "number" && !suffix ? max.toLocaleString() : max}${suffix || ""}`}
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-bar-fill"
                          style={{ width: loading ? "0%" : `${pct}%`, background: color }}
                        />
                      </div>
                      <span className={`text-[9px] font-bold ${text}`}>
                        {loading ? "" : `${pct.toFixed(1)}% consumed`}
                        {pct > 80 && !loading && " — approaching limit"}
                      </span>
                    </div>
                  ))}

                  {/* Workspace info */}
                  <div className="border-t border-border/40 pt-4 space-y-2">
                    {[
                      { label: "Workspace", value: workspace?.name || "My Workspace" },
                      { label: "Members", value: workspace?.memberCount || 1 },
                      { label: "Plan", value: "Pro" },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between text-xs">
                        <span className="text-slate-500 font-medium">{label}</span>
                        <span className="text-slate-200 font-semibold">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Monthly Cost Chart */}
              <div className="glass-panel p-5 lg:col-span-2 flex flex-col">
                <div className="section-header mb-4">
                  <div>
                    <h3 className="section-title">Monthly Cost Trend</h3>
                    <p className="section-subtitle">Estimated at ${COST_PER_EXEC}/execution</p>
                  </div>
                  {curMonth && (
                    <div className="flex items-center gap-1 text-xs font-bold">
                      {Number(costTrend) >= 0
                        ? <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                        : <TrendingUp className="w-3.5 h-3.5 text-emerald-400 rotate-180" />
                      }
                      <span className={Number(costTrend) >= 0 ? "text-amber-400" : "text-emerald-400"}>
                        {Number(costTrend) >= 0 ? "+" : ""}{costTrend}% MoM
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 h-52">
                  {loading ? (
                    <div className="h-full skeleton rounded-xl" />
                  ) : monthlyData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
                      <Calendar className="w-8 h-8 text-slate-700" />
                      <p className="text-sm text-slate-500 font-medium">No usage data yet</p>
                      <p className="text-[11px] text-slate-600">Run some workflows to see cost trends</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gCost" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#F25E22" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#F25E22" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="month" stroke="transparent" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                        <YAxis stroke="transparent" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickFormatter={v => `$${v}`} />
                        <Tooltip content={<ChartTooltip />} formatter={(v: any) => [`$${v}`, "Cost"]} />
                        <Area type="monotone" dataKey="cost" name="Cost ($)" stroke="#F25E22" strokeWidth={2} fill="url(#gCost)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </section>

            {/* Cost Notice */}
            <div className="flex items-start gap-3 p-4 rounded-xl border border-border/40 bg-white/[0.02] text-xs text-slate-500">
              <DollarSign className="w-4 h-4 flex-shrink-0 text-slate-600 mt-0.5" />
              <p>
                Cost estimates are based on <strong className="text-slate-300">${COST_PER_EXEC}</strong> per execution.
                Actual billing would integrate with Stripe and vary by model usage (AI tokens, API calls, etc.).
                Contact sales for custom enterprise pricing.
              </p>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
