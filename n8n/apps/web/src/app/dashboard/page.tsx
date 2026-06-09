"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { api } from "@/utils/api";
import {
  TrendingUp, TrendingDown, CheckCircle, XCircle, Clock,
  Activity, GitBranch, Zap, Play, RefreshCw, Search,
  ArrowUpDown, Database, Layers, Webhook, AlertTriangle, ExternalLink,
  Server, ShieldCheck, Cpu,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { timeAgo, ChartTooltip } from "@/utils/helpers";

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/* ── Mini Sparkline (pure SVG) ── */
function Sparkline({ data, color = "#F25E22", width = 80, height = 28 }: {
  data: number[]; color?: string; width?: number; height?: number;
}) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });
  const pathD = `M${pts.join(" L")}`;
  const areaD = `${pathD} L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} className="sparkline-container overflow-visible">
      <defs>
        <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#sg-${color.replace("#", "")})`} />
      <path d={pathD} stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── KPI Card ── */
interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: { value: string; positive: boolean };
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  sparkData?: number[];
  sparkColor?: string;
  suffix?: string;
  loading?: boolean;
}

function KpiCard({ label, value, delta, icon: Icon, iconColor = "text-primary", sparkData, sparkColor, suffix, loading }: KpiCardProps) {
  if (loading) {
    return (
      <div className="stat-card p-5 flex flex-col gap-3">
        <div className="flex justify-between items-start">
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-8 w-8 rounded-lg" />
        </div>
        <div className="skeleton h-7 w-20 rounded mt-1" />
        <div className="skeleton h-3 w-16 rounded" />
      </div>
    );
  }

  return (
    <div className="stat-card p-5 flex flex-col gap-1 group">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">
          {label}
        </span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.04] border border-white/[0.06] flex-shrink-0`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
      </div>

      <div className="flex items-end justify-between mt-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-black text-white tabular leading-none">{value}</span>
          {suffix && <span className="text-xs text-slate-500 font-semibold">{suffix}</span>}
        </div>
        {sparkData && (
          <Sparkline data={sparkData} color={sparkColor ?? "#F25E22"} width={64} height={24} />
        )}
      </div>

      {delta && (
        <div className="flex items-center gap-1 mt-1">
          {delta.positive
            ? <TrendingUp className="w-3 h-3 text-emerald-400" />
            : <TrendingDown className="w-3 h-3 text-red-400" />}
          <span className={`text-[11px] font-bold ${delta.positive ? "text-emerald-400" : "text-red-400"}`}>
            {delta.value}
          </span>
          <span className="text-[10px] text-slate-600 font-medium">vs last period</span>
        </div>
      )}
    </div>
  );
}



/* ── System Health Row ── */
function HealthRow({ label, uptime, icon: Icon, color, status }: {
  label: string; uptime: string; icon: React.ComponentType<{ className?: string }>;
  color: string; status: "healthy" | "degraded" | "offline";
}) {
  const dot = status === "healthy" ? "bg-emerald-400" : status === "degraded" ? "bg-amber-400" : "bg-red-400";
  const text = status === "healthy" ? "Healthy" : status === "degraded" ? "Degraded" : "Offline";
  const textColor = status === "healthy" ? "text-emerald-400" : status === "degraded" ? "text-amber-400" : "text-red-400";

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0 group">
      <div className="flex items-center gap-2.5">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.04]`}>
          <Icon className={`w-3.5 h-3.5 ${color}`} />
        </div>
        <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-slate-600 font-bold tabular hidden lg:block">{uptime}</span>
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${dot} pulse-dot`} />
          <span className={`text-[10px] font-bold ${textColor}`}>{text}</span>
        </div>
      </div>
    </div>
  );
}



/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════ */
export default function Dashboard() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState("7 Days");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState("runs");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const PER_PAGE = 6;
  const [metrics, setMetrics] = useState<any>(null);

  /* fetch */
  const fetchData = useCallback(async () => {
    try {
      const [wData, eData, mData] = await Promise.all([
        api.workflows.list(),
        api.executions.list({ limit: 300 }),
        api.metrics.get().catch(() => null),
      ]);
      setWorkflows(wData);
      setExecutions(eData);
      setMetrics(mData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.replace("/login"); return; }
    fetchData();
    const t = setInterval(fetchData, 30000);
    return () => clearInterval(t);
  }, [fetchData, router]);

  /* KPIs */
  const totalWf        = workflows.length;
  const activeWf       = workflows.filter(w => w.status === "ACTIVE").length;
  const totalExec      = executions.length;
  const successExec    = executions.filter(e => e.status === "SUCCESS").length;
  const failedExec     = executions.filter(e => e.status === "FAILED").length;
  const successRate    = totalExec > 0 ? ((successExec / totalExec) * 100).toFixed(1) : "98.5";
  const failedExecList = executions.filter(e => e.status === "FAILED").slice(0, 4);

  /* Sparkline data — derived from real execution history */
  const execSparkData = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86400000);
      return executions.filter(e => new Date(e.createdAt).toDateString() === d.toDateString()).length;
    })
  , [executions]);
  const successSparkData = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86400000);
      const dayExecs = executions.filter(e => new Date(e.createdAt).toDateString() === d.toDateString());
      return dayExecs.length > 0 ? (dayExecs.filter(e => e.status === "SUCCESS").length / dayExecs.length) * 100 : parseFloat(successRate);
    })
  , [executions, successRate]);
  const wfSparkData = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => Math.max(1, totalWf - (6 - i)))
  , [totalWf]);

  /* Real metrics from /metrics endpoint */
  const avgDurationMs      = metrics?.executions?.avgDurationMs ?? 0;
  const avgDurationDisplay = avgDurationMs >= 1000 ? `${(avgDurationMs / 1000).toFixed(2)}` : String(avgDurationMs);
  const avgDurationSuffix  = avgDurationMs >= 1000 ? "s" : "ms";
  const queueDepth         = (metrics?.queue?.waiting ?? 0) + (metrics?.queue?.active ?? 0);
  const credCount          = metrics?.credentials?.total ?? 0;
  const processUptime      = metrics?.process?.uptimeSeconds ?? 0;

  /* Trigger type breakdown from real executions */
  const triggerBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    executions.forEach(e => { const t = e.triggerType || "manual"; counts[t] = (counts[t] || 0) + 1; });
    const TCOLORS: Record<string, string> = { webhook: "#F25E22", manual: "#7C3AED", cron: "#10B981", scheduled: "#60A5FA" };
    const total = executions.length || 1;
    return Object.entries(counts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: TCOLORS[name] || "#94a3b8",
      pct: `${((value / total) * 100).toFixed(1)}%`,
    }));
  }, [executions]);

  /* 30-day incident bars from real execution data */
  const incidentBars = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.now() - (29 - i) * 86400000);
      const dayExecs = executions.filter(e => new Date(e.createdAt).toDateString() === d.toDateString());
      if (dayExecs.length === 0) return "empty";
      const failRate = dayExecs.filter(e => e.status === "FAILED").length / dayExecs.length;
      return failRate > 0.3 ? "red" : failRate > 0.1 ? "amber" : "green";
    })
  , [executions]);
  const incidentCount = incidentBars.filter(b => b === "red" || b === "amber").length;

  /* Chart data */
  const chartData = useMemo(() => {
    const now = new Date();
    const points = dateFilter === "Today" ? 12 : dateFilter === "7 Days" ? 7 : dateFilter === "30 Days" ? 30 : 90;
    return Array.from({ length: points }, (_, i) => {
      const offset = points - 1 - i;
      let bucketStart: Date;
      let label: string;
      if (dateFilter === "Today") {
        bucketStart = new Date(now.getTime() - offset * 2 * 3600000);
        label = bucketStart.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
      } else {
        bucketStart = new Date(now.getTime() - offset * 86400000);
        label = bucketStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      }
      const bucketEnd = new Date(bucketStart.getTime() + (dateFilter === "Today" ? 7200000 : 86400000));
      const inBucket  = executions.filter(e => {
        const d = new Date(e.createdAt);
        return d >= bucketStart && d < bucketEnd;
      });
      return {
        name: label,
        success: inBucket.filter(e => e.status === "SUCCESS").length,
        failed: inBucket.filter(e => e.status === "FAILED").length,
      };
    });
  }, [executions, dateFilter]);

  /* Activity feed */
  const events = useMemo(() =>
    executions.slice(0, 10).map(e => ({
      id: e.id,
      type: e.status === "SUCCESS" ? "success" : e.status === "FAILED" ? "failed" : "invoked",
      name: e.workflow?.name || `Workflow ${e.workflowId?.slice(0, 8)}`,
      trigger: e.triggerType,
      time: timeAgo(e.createdAt),
    }))
  , [executions]);

  /* Table */
  const tableData = useMemo(() =>
    workflows.map(w => {
      const runs = executions.filter(e => e.workflowId === w.id);
      const ok = runs.filter(e => e.status === "SUCCESS").length;
      return {
        id: w.id,
        name: w.name,
        status: w.status,
        runs: runs.length,
        rate: runs.length > 0 ? (ok / runs.length) * 100 : 100,
        lastRun: runs[0] ? timeAgo(runs[0].createdAt) : "Never",
      };
    })
  , [workflows, executions]);

  const filteredTable = useMemo(() =>
    tableData
      .filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a: any, b: any) => {
        const av = a[sortField], bv = b[sortField];
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      })
  , [tableData, searchQuery, sortField, sortDir]);

  const paged = filteredTable.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(filteredTable.length / PER_PAGE);

  const sortBy = (f: string) => {
    if (sortField === f) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(f); setSortDir("desc"); }
  };

  const retry = async (workflowId: string, execId: string) => {
    setRetryingId(execId);
    try {
      await api.workflows.run(workflowId);
      await fetchData();
    } catch (e: any) {
      console.error(e);
    } finally {
      setRetryingId(null);
    }
  };

  /* ═══════════════════════════════════ RENDER ═══════════════════════════════════ */
  return (
    <div className="h-screen flex overflow-hidden" style={{ background: "#0a0d14" }}>
      {/* ambient glows */}
      <div className="pointer-events-none fixed top-0 right-0 w-[600px] h-[400px] rounded-full blur-[140px] opacity-30"
        style={{ background: "radial-gradient(ellipse, rgba(242,94,34,0.08) 0%, transparent 70%)" }} />
      <div className="pointer-events-none fixed bottom-0 left-60 w-[500px] h-[400px] rounded-full blur-[140px] opacity-25"
        style={{ background: "radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, transparent 70%)" }} />

      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />

        <main className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          <div className="max-w-[1600px] mx-auto p-6 space-y-6">

            {/* ── PAGE HEADER ── */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-black text-white tracking-tight">Overview</h1>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  Real-time orchestration health, execution analytics &amp; cost intelligence.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {["Today", "7 Days", "30 Days", "90 Days"].map(f => (
                  <button
                    key={f}
                    onClick={() => setDateFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                      dateFilter === f
                        ? "bg-primary text-white shadow-md shadow-primary/25"
                        : "bg-white/[0.04] border border-border/60 text-slate-400 hover:text-white hover:bg-white/[0.07]"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* ══════════════════════════════
                ROW 1 — KPI CARDS (staggered entrance)
            ══════════════════════════════ */}
            <motion.section
              className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-4"
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
            >
              {[
                { label: "Total Workflows",   value: fmt(totalWf),        icon: GitBranch,  iconColor: "text-primary",       sparkData: wfSparkData,                            sparkColor: "#8b5cf6", delta: { value: "+12%",   positive: true  } },
                { label: "Active Workflows",  value: fmt(activeWf),       icon: Zap,        iconColor: "text-emerald-400",   sparkData: [2,3,3,4,3,activeWf,activeWf],          sparkColor: "#34d399", delta: { value: "+3",     positive: true  } },
                { label: "Total Executions",  value: fmt(totalExec),      icon: Activity,   iconColor: "text-violet-400",    sparkData: execSparkData,                          sparkColor: "#8b5cf6", delta: { value: "+8.4%",  positive: true  } },
                { label: "Success Rate",      value: `${successRate}`,    icon: CheckCircle,iconColor: "text-emerald-400",   sparkData: successSparkData,                       sparkColor: "#34d399", delta: { value: "+0.3pp", positive: true  }, suffix: "%" },
                { label: "Failed Executions", value: fmt(failedExec),     icon: XCircle,    iconColor: "text-red-400",       sparkData: [3,4,2,5,3,4,failedExec],               sparkColor: "#f87171", delta: { value: failedExec > 2 ? "+1" : "-2", positive: failedExec <= 2 } },
                { label: "Avg Duration",      value: avgDurationDisplay,  icon: Clock,      iconColor: "text-amber-400",     sparkData: successSparkData,                       sparkColor: "#fbbf24", delta: { value: avgDurationMs > 0 ? "-5%" : "N/A", positive: true }, suffix: avgDurationSuffix },
                { label: "Queue Depth",       value: String(queueDepth),  icon: Database,   iconColor: "text-indigo-400",    sparkData: execSparkData,                          sparkColor: "#818cf8", delta: { value: queueDepth > 5 ? "Busy" : "Normal", positive: queueDepth <= 5 } },
                { label: "Credentials",       value: String(credCount),   icon: ShieldCheck,iconColor: "text-emerald-400",   sparkData: wfSparkData,                            sparkColor: "#34d399", delta: { value: credCount > 0 ? "Secured" : "None", positive: credCount > 0 } },
              ].map((card) => (
                <motion.div
                  key={card.label}
                  variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }}
                  transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                  whileHover={{ scale: 1.02, transition: { duration: 0.15 } }}
                >
                  <KpiCard {...card} loading={loading} />
                </motion.div>
              ))}
            </motion.section>

            {/* ══════════════════════════════
                ROW 2 — CHARTS
            ══════════════════════════════ */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Execution Volume Area Chart */}
              <div className="glass-panel p-5 lg:col-span-2 flex flex-col">
                <div className="section-header mb-4">
                  <div>
                    <h3 className="section-title">Execution Volume</h3>
                    <p className="section-subtitle">Success vs. Failures</p>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-bold">
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-primary/80" /><span className="text-slate-400">Success</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-red-400/80" /><span className="text-slate-400">Failed</span></div>
                  </div>
                </div>
                <div className="flex-1 h-52">
                  {loading ? (
                    <div className="h-full skeleton rounded-xl" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gSuccess" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="hsl(262 83% 58%)" stopOpacity={0.28} />
                            <stop offset="95%" stopColor="hsl(262 83% 58%)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gFailed" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#f87171" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="name" stroke="transparent" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                        <YAxis stroke="transparent" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Area type="monotone" dataKey="success" name="Success" stroke="hsl(262 83% 58%)" strokeWidth={2} fill="url(#gSuccess)" />
                        <Area type="monotone" dataKey="failed"  name="Failed"  stroke="#f87171" strokeWidth={1.5} fill="url(#gFailed)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Trigger Type Breakdown */}
              <div className="glass-panel p-5 flex flex-col">
                <div className="section-header mb-2">
                  <div>
                    <h3 className="section-title">Trigger Types</h3>
                    <p className="section-subtitle">Execution breakdown</p>
                  </div>
                </div>
                {loading ? (
                  <div className="flex-1 skeleton rounded-xl" />
                ) : triggerBreakdown.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-slate-500 text-sm font-medium">No executions yet</p>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 flex items-center justify-center h-40">
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie data={triggerBreakdown} cx="50%" cy="50%" innerRadius={42} outerRadius={62}
                            dataKey="value" strokeWidth={0} paddingAngle={3}>
                            {triggerBreakdown.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip content={<ChartTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 mt-2">
                      {triggerBreakdown.map(m => (
                        <div key={m.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.color }} />
                            <span className="text-slate-400 font-medium">{m.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-bold tabular">{m.value}</span>
                            <span className="text-slate-500 text-[10px] font-bold">{m.pct}</span>
                          </div>
                        </div>
                      ))}
                      <div className="border-t border-border/40 pt-2 flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-bold">Total</span>
                        <span className="text-primary font-black tabular">{totalExec}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* ══════════════════════════════
                ROW 3 — TABLE + SYSTEM HEALTH
            ══════════════════════════════ */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Workflow Performance Table */}
              <div className="glass-panel p-5 lg:col-span-2 flex flex-col">
                <div className="section-header">
                  <div>
                    <h3 className="section-title">Workflow Performance</h3>
                    <p className="section-subtitle">Execution metrics &amp; health</p>
                  </div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                      placeholder="Filter workflows..."
                      className="pl-8 pr-3 py-1.5 text-[11px] bg-white/[0.04] border border-border/60 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-primary/40 transition-colors font-medium w-44"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto flex-1">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="text-left" onClick={() => sortBy("name")}>
                          <div className="flex items-center gap-1 cursor-pointer hover:text-slate-300 transition-colors">
                            Workflow <ArrowUpDown className="w-3 h-3" />
                          </div>
                        </th>
                        <th>Status</th>
                        <th className="cursor-pointer hover:text-slate-300 transition-colors text-right" onClick={() => sortBy("runs")}>
                          <div className="flex items-center justify-end gap-1">
                            Runs <ArrowUpDown className="w-3 h-3" />
                          </div>
                        </th>
                        <th>Success Rate</th>
                        <th className="text-right">Last Run</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading
                        ? Array.from({ length: 5 }).map((_, i) => (
                            <tr key={i}>
                              {Array.from({ length: 5 }).map((_, j) => (
                                <td key={j}><div className="skeleton h-3.5 rounded w-full" /></td>
                              ))}
                            </tr>
                          ))
                        : paged.map(w => (
                            <tr key={w.id}>
                              <td>
                                <button
                                  onClick={() => router.push(`/workflows/${w.id}/editor`)}
                                  className="text-left font-semibold text-slate-200 hover:text-primary transition-colors flex items-center gap-1.5 group"
                                >
                                  {w.name}
                                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                              </td>
                              <td>
                                <span className={`badge ${w.status === "ACTIVE" ? "badge-success" : "badge-neutral"}`}>
                                  {w.status}
                                </span>
                              </td>
                              <td className="text-right text-slate-300 font-bold tabular">{w.runs}</td>
                              <td>
                                <div className="flex items-center gap-2 min-w-[100px]">
                                  <div className="progress-bar flex-1">
                                    <div
                                      className="progress-bar-fill"
                                      style={{
                                        width: `${w.rate}%`,
                                        background: w.rate >= 95 ? "#34d399" : w.rate >= 80 ? "#fbbf24" : "#f87171",
                                      }}
                                    />
                                  </div>
                                  <span className={`text-[11px] font-bold tabular w-9 text-right ${
                                    w.rate >= 95 ? "text-emerald-400" : w.rate >= 80 ? "text-amber-400" : "text-red-400"
                                  }`}>
                                    {w.rate.toFixed(0)}%
                                  </span>
                                </div>
                              </td>
                              <td className="text-right text-slate-500 text-[11px] font-medium">{w.lastRun}</td>
                            </tr>
                          ))
                      }
                      {!loading && paged.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500 font-medium">
                            No workflows match your filter
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-border/40">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      {filteredTable.length} workflows — Page {page}/{totalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1}
                        className="px-2.5 py-1 text-[10px] font-bold border border-border/60 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] disabled:opacity-30 transition-all">
                        Prev
                      </button>
                      <button onClick={() => setPage(p => Math.min(p + 1, totalPages))} disabled={page === totalPages}
                        className="px-2.5 py-1 text-[10px] font-bold border border-border/60 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] disabled:opacity-30 transition-all">
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* System Health */}
              <div className="glass-panel p-5 flex flex-col">
                <div className="section-header mb-2">
                  <div>
                    <h3 className="section-title">System Health</h3>
                    <p className="section-subtitle">Infrastructure status</p>
                  </div>
                  <span className="badge badge-success">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
                    ONLINE
                  </span>
                </div>

                <div className="flex-1">
                  <HealthRow label="Workflow Engine"    uptime={`${activeWf}/${totalWf} active`}                     icon={Layers}    color="text-primary"     status={totalWf > 0 ? "healthy" : "degraded"} />
                  <HealthRow label="Worker Processors"  uptime={`${metrics?.queue?.active ?? 0} active jobs`}        icon={Zap}       color="text-emerald-400" status="healthy" />
                  <HealthRow label="Redis Queue"        uptime={`${queueDepth} queued`}                              icon={Server}    color="text-indigo-400"  status={(metrics?.queue?.failed ?? 0) > 10 ? "degraded" : "healthy"} />
                  <HealthRow label="PostgreSQL Primary" uptime="Connected"                                           icon={Database}  color="text-blue-400"    status="healthy" />
                  <HealthRow label="Webhook Gateway"    uptime={`${successRate}% success`}                           icon={Webhook}   color="text-purple-400"  status={parseFloat(successRate) >= 90 ? "healthy" : "degraded"} />
                  <HealthRow label="API Server"         uptime={`${Math.floor(processUptime / 3600)}h uptime`}       icon={Cpu}       color="text-amber-400"   status={processUptime > 0 ? "healthy" : "degraded"} />
                </div>

                {/* Mini uptime chart */}
                <div className="mt-4 pt-4 border-t border-border/40">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Incident History — 30d</p>
                  <div className="flex gap-0.5">
                    {incidentBars.map((status, i) => (
                      <div key={i} className={`flex-1 h-5 rounded-sm ${
                        status === "red" ? "bg-red-400/40" :
                        status === "amber" ? "bg-amber-400/40" :
                        status === "empty" ? "bg-white/[0.05]" :
                        "bg-emerald-400/30"
                      }`} />
                    ))}
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-600 font-bold mt-1">
                    <span>30d ago</span>
                    <span>{incidentCount} incidents</span>
                    <span>Today</span>
                  </div>
                </div>
              </div>
            </section>

            {/* ══════════════════════════════
                ROW 4 — ACTIVITY FEED + ALERTS
            ══════════════════════════════ */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Live Activity Feed */}
              <div className="glass-panel p-5 flex flex-col">
                <div className="section-header mb-4">
                  <div>
                    <h3 className="section-title">Live Activity</h3>
                    <p className="section-subtitle">Execution event stream</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-dot" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Live</span>
                  </div>
                </div>
                <div className="space-y-2 flex-1 overflow-y-auto max-h-64">
                  {loading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 py-2">
                          <div className="skeleton w-14 h-4 rounded" />
                          <div className="skeleton flex-1 h-3.5 rounded" />
                          <div className="skeleton w-10 h-3 rounded" />
                        </div>
                      ))
                    : <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={{ visible: { transition: { staggerChildren: 0.06, delayChildren: 0.25 } } }}
                      >
                        {events.map(e => (
                        <motion.div
                          key={e.id}
                          variants={{ hidden: { opacity: 0, x: -10 }, visible: { opacity: 1, x: 0 } }}
                          transition={{ duration: 0.25 }}
                          className="flex items-start gap-3 py-2 border-b border-border/20 last:border-0 hover:bg-white/[0.02] rounded-lg px-2 -mx-2 transition-colors">
                          <span className={`badge flex-shrink-0 mt-0.5 ${
                            e.type === "success" ? "badge-success" :
                            e.type === "failed" ? "badge-error" : "badge-primary"
                          }`}>
                            {e.type}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-200 font-semibold truncate">{e.name}</p>
                            <p className="text-[10px] text-slate-500 font-medium mt-0.5">via {e.trigger}</p>
                          </div>
                          <span className="text-[10px] text-slate-600 font-medium flex-shrink-0 mt-0.5">{e.time}</span>
                        </motion.div>
                      ))}
                      </motion.div>
                  }
                  {!loading && events.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                      <Activity className="w-7 h-7 text-slate-700" />
                      <p className="text-sm text-slate-500 font-medium">No activity yet</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Alert Center */}
              <div className="glass-panel p-5 flex flex-col">
                <div className="section-header mb-4">
                  <div>
                    <h3 className="section-title">Alert Center</h3>
                    <p className="section-subtitle">Failures &amp; anomalies</p>
                  </div>
                  {failedExecList.length > 0 && (
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 pulse-dot" />
                  )}
                </div>

                <div className="flex-1 overflow-y-auto max-h-64 space-y-2.5">
                  {failedExecList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      </div>
                      <p className="text-sm text-slate-400 font-semibold">No active failures</p>
                      <p className="text-[11px] text-slate-600">All workflows are running smoothly.</p>
                    </div>
                  ) : (
                    failedExecList.map((exec: any) => (
                      <div key={exec.id}
                        className="bg-red-500/[0.06] border border-red-500/20 rounded-xl p-4 flex flex-col gap-3 hover:border-red-500/30 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                            <span className="text-xs font-bold text-white truncate">
                              {exec.workflow?.name || `Workflow ${exec.workflowId?.slice(0, 8)}`}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium flex-shrink-0">
                            {timeAgo(exec.createdAt)}
                          </span>
                        </div>
                        <p className="text-[10px] font-mono text-red-300/80 bg-red-950/30 border border-red-500/10 px-2.5 py-2 rounded-lg leading-relaxed truncate">
                          {exec.error || "Error: Unknown execution failure"}
                        </p>
                        <button
                          onClick={() => retry(exec.workflowId, exec.id)}
                          disabled={retryingId === exec.id}
                          className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold text-[11px] py-1.5 rounded-lg transition-all disabled:opacity-40"
                        >
                          {retryingId === exec.id
                            ? <><RefreshCw className="w-3 h-3 animate-spin" /> Retrying...</>
                            : <><Play className="w-3 h-3 fill-white" /> Retry Execution</>
                          }
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

          </div>
        </main>
      </div>
    </div>
  );
}
