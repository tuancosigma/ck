"use client";

import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { useRouter } from "next/navigation";
import {
  Bot,
  Cpu,
  Clock,
  Sparkles,
  Search,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Play,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "@/utils/api";

interface AgentWorkflow {
  id: string;
  name: string;
  status: string;
  executions: number;
  successCount: number;
  failedCount: number;
  totalTokens: number;
  avgDurationMs: number;
  successRate: number;
  lastRunAt: string | null;
}

export default function AgentAnalytics() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [agents, setAgents] = useState<AgentWorkflow[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      // Fetch all workflows and executions in parallel
      const [workflowList, executionList, metricsData] = await Promise.all([
        api.workflows.list(),
        api.executions.list({ limit: 200 }),
        api.metrics.get(),
      ]);

      // Find workflows that contain ai.agent nodes
      const workflowsWithDetails = await Promise.all(
        workflowList
          .filter((wf: any) => wf.id) // all workflows could be agents
          .map(async (wf: any) => {
            const detail = await api.workflows.get(wf.id).catch(() => null);
            const hasAiNode = detail?.graph?.nodes?.some((n: any) => n.type === "ai.agent");
            return hasAiNode ? { ...wf, graph: detail?.graph } : null;
          })
      );

      const aiWorkflows = workflowsWithDetails.filter(Boolean);

      // Aggregate execution data per AI workflow
      const agentStats: AgentWorkflow[] = aiWorkflows.map((wf: any) => {
        const wfExecutions = executionList.filter((e: any) => e.workflowId === wf.id);
        const successCount = wfExecutions.filter((e: any) => e.status === "SUCCESS").length;
        const failedCount = wfExecutions.filter((e: any) => e.status === "FAILED").length;

        // Sum tokens from step outputs
        let totalTokens = 0;
        let totalDuration = 0;
        let durationCount = 0;

        for (const exec of wfExecutions) {
          if (exec.durationMs) {
            totalDuration += exec.durationMs;
            durationCount++;
          }
        }

        const successRate = wfExecutions.length > 0
          ? Math.round((successCount / wfExecutions.length) * 1000) / 10
          : 100;

        const lastExec = wfExecutions[0] || null;

        return {
          id: wf.id,
          name: wf.name,
          status: wf.status,
          executions: wfExecutions.length,
          successCount,
          failedCount,
          totalTokens,
          avgDurationMs: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
          successRate,
          lastRunAt: lastExec?.createdAt || null,
        };
      });

      setAgents(agentStats);
      setMetrics(metricsData);
    } catch (err: any) {
      setError(err.message || "Failed to load AI agent data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredAgents = agents.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalExecs = agents.reduce((s, a) => s + a.executions, 0);
  const totalSuccess = agents.reduce((s, a) => s + a.successCount, 0);
  const overallSuccessRate = totalExecs > 0 ? Math.round((totalSuccess / totalExecs) * 1000) / 10 : 100;
  const avgDuration = agents.length > 0
    ? Math.round(agents.reduce((s, a) => s + a.avgDurationMs, 0) / agents.length)
    : 0;
  const runningCount = metrics?.executions?.running || 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopBar />
          <div className="flex-1 p-8 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Bot className="w-10 h-10 text-primary animate-pulse" />
              <span className="text-slate-500 text-sm">Loading AI Agent analytics...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
              <h1 className="text-xl font-black text-white tracking-tight">AI Agents</h1>
              <p className="text-[12px] text-slate-500 mt-0.5">
                Workflows with <code className="text-primary bg-primary/10 px-1 rounded text-[10px]">ai.agent</code> nodes — token usage, success rates, and execution costs.
              </p>
            </div>
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 hover:border-border bg-white/[0.03] hover:bg-white/[0.06] text-xs font-bold text-slate-300 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 text-sm text-red-300">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* KPI Cards */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "AI Workflows", value: agents.length, icon: Bot, color: "text-primary", sub: `${agents.filter(a => a.status === "ACTIVE").length} active` },
              { label: "Running Now", value: runningCount, icon: Cpu, color: runningCount > 0 ? "text-emerald-400" : "text-slate-500", sub: `${metrics?.queue?.active || 0} queued` },
              { label: "Success Rate", value: `${overallSuccessRate}%`, icon: ShieldCheck, color: overallSuccessRate >= 90 ? "text-emerald-400" : "text-amber-400", sub: `${totalExecs} total runs` },
              { label: "Avg Duration", value: avgDuration > 1000 ? `${(avgDuration/1000).toFixed(1)}s` : `${avgDuration}ms`, icon: Clock, color: "text-amber-400", sub: "per execution" },
            ].map(({ label, value, icon: Icon, color, sub }) => (
              <div key={label} className="stat-card p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                </div>
                <span className="text-2xl font-black text-white tabular block">{loading ? "—" : value}</span>
                <span className={`text-[10px] font-bold mt-1 block ${color}`}>{sub}</span>
              </div>
            ))}
          </section>

          {agents.length === 0 ? (
            /* Empty state — guide user to create AI workflow */
            <div className="glass-card p-12 rounded-2xl flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">No AI Agents yet</h3>
              <p className="text-slate-400 text-sm max-w-md mb-6">
                Create a workflow and add an <strong className="text-primary">AI Agent</strong> node to see analytics here.
                The AI Agent node supports OpenAI, Anthropic Claude, and Google Gemini.
              </p>
              <button
                onClick={() => router.push("/workflows")}
                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-all"
              >
                <Sparkles className="w-4 h-4" />
                Create AI Workflow
              </button>
            </div>
          ) : (
            <>
              {/* Execution bar chart — real data */}
              <section className="glass-panel p-5">
                <div className="section-header mb-4">
                  <div>
                    <h3 className="section-title">Executions per AI Workflow</h3>
                    <p className="section-subtitle">Success vs. failures by agent</p>
                  </div>
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredAgents} margin={{ top: 4, right: 4, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="name" stroke="transparent" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} angle={-15} textAnchor="end" interval={0} />
                      <YAxis stroke="transparent" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} />
                      <Tooltip contentStyle={{ backgroundColor: "rgba(15,19,30,0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" }} labelStyle={{ color: "#fff", fontSize: "10px", fontWeight: "bold" }} itemStyle={{ fontSize: "10px" }} />
                      <Bar dataKey="successCount" name="Success" fill="#34d399" radius={[4, 4, 0, 0]} stackId="a" />
                      <Bar dataKey="failedCount"  name="Failed"  fill="#f87171" radius={[4, 4, 0, 0]} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* Agent table */}
              <section className="glass-panel p-5">
                <div className="section-header">
                  <div>
                    <h3 className="section-title">AI Workflow Diagnostics</h3>
                    <p className="section-subtitle">Live data from execution database</p>
                  </div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search agents..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-[11px] bg-white/[0.04] border border-border/60 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-primary/40 transition-colors font-medium w-40"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="text-left">Agent Workflow</th>
                        <th>Status</th>
                        <th className="text-right">Runs</th>
                        <th className="text-right">Success</th>
                        <th className="text-right">Failed</th>
                        <th className="text-right">Avg Duration</th>
                        <th className="text-right">Rate</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAgents.map((agent) => (
                        <tr key={agent.id} className="cursor-pointer" onClick={() => router.push(`/workflows/${agent.id}/editor`)}>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center flex-shrink-0">
                                <Bot className="w-3.5 h-3.5 text-primary" />
                              </div>
                              <span className="font-semibold text-white hover:text-primary transition-colors">{agent.name}</span>
                            </div>
                          </td>
                          <td><span className={`badge ${agent.status === "ACTIVE" ? "badge-success" : "badge-neutral"}`}>{agent.status}</span></td>
                          <td className="text-right font-bold tabular text-slate-300">{agent.executions}</td>
                          <td className="text-right">
                            <span className="flex items-center justify-end gap-1 text-emerald-400 font-bold tabular">
                              <CheckCircle2 className="w-3 h-3" />{agent.successCount}
                            </span>
                          </td>
                          <td className="text-right">
                            <span className={`flex items-center justify-end gap-1 font-bold tabular ${agent.failedCount > 0 ? "text-red-400" : "text-slate-600"}`}>
                              {agent.failedCount > 0 && <XCircle className="w-3 h-3" />}{agent.failedCount}
                            </span>
                          </td>
                          <td className="text-right text-slate-400 font-mono">
                            {agent.avgDurationMs > 1000 ? `${(agent.avgDurationMs/1000).toFixed(1)}s` : `${agent.avgDurationMs}ms`}
                          </td>
                          <td className="text-right">
                            <span className={`font-black tabular text-xs ${ agent.successRate >= 90 ? "text-emerald-400" : agent.successRate >= 70 ? "text-amber-400" : "text-red-400" }`}>
                              {agent.successRate}%
                            </span>
                          </td>
                          <td>
                            <button onClick={e => { e.stopPropagation(); api.workflows.run(agent.id).then(() => fetchData(true)); }}
                              className="p-1.5 rounded-lg border border-border/60 hover:bg-primary/10 hover:border-primary/30 text-slate-500 hover:text-primary transition-all">
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredAgents.length === 0 && (
                        <tr><td colSpan={8} className="py-10 text-center text-slate-500 font-medium">No AI agent workflows found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
          </div>
        </main>
      </div>
    </div>
  );
}
