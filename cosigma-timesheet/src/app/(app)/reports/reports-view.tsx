"use client";

import { useState } from "react";
import { FileDown, Loader2, SlidersHorizontal } from "lucide-react";
import { PageContainer } from "@/components/ui/motion";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Select, Label } from "@/components/ui/field";
import { Badge, statusTone } from "@/components/ui/badge";
import { fmtDate, fmtHours, fmtPct } from "@/lib/format";
import { exportReportPdf } from "@/lib/pdf-export";
import type { ReportOptions, ReportResult } from "@/lib/data/reports";

export function ReportsView({
  options,
  initial,
}: {
  options: ReportOptions;
  initial: ReportResult;
}) {
  const [report, setReport] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    customerId: "",
    projectId: "",
    userId: "",
    period: "",
  });

  const projectsForCustomer = filters.customerId
    ? options.projects.filter((p) => p.customerId === filters.customerId)
    : options.projects;

  async function applyFilters(next: typeof filters) {
    setFilters(next);
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => v && params.set(k, v));
    const res = await fetch(`/api/reports?${params}`);
    const data = await res.json();
    setReport(data);
    setLoading(false);
  }

  function set<K extends keyof typeof filters>(key: K, value: string) {
    const next = { ...filters, [key]: value };
    if (key === "customerId") next.projectId = ""; // reset dependent filter
    applyFilters(next);
  }

  const s = report.summary;
  const contextLabel = [
    filters.userId && options.users.find((u) => u.id === filters.userId)?.name,
    filters.customerId && options.customers.find((c) => c.id === filters.customerId)?.name,
  ]
    .filter(Boolean)
    .join(" · ") || "All members";

  return (
    <PageContainer className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports & Export</h1>
          <p className="text-sm text-slate-400">
            {report.periodLabel} · {s.entryCount} entries
          </p>
        </div>
        <Button variant="primary" onClick={() => exportReportPdf(report, contextLabel)}>
          <FileDown size={16} /> Export PDF
        </Button>
      </header>

      {/* Filters */}
      <GlassCard className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <SlidersHorizontal size={16} className="text-indigo-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Filters
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Customer</Label>
            <Select value={filters.customerId} onChange={(e) => set("customerId", e.target.value)}>
              <option value="">All customers</option>
              {options.customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Project</Label>
            <Select value={filters.projectId} onChange={(e) => set("projectId", e.target.value)}>
              <option value="">All projects</option>
              {projectsForCustomer.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>User</Label>
            <Select value={filters.userId} onChange={(e) => set("userId", e.target.value)}>
              <option value="">All users</option>
              {options.users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Payroll Period</Label>
            <Select value={filters.period} onChange={(e) => set("period", e.target.value)}>
              {options.periods.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </div>
        </div>
      </GlassCard>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryStat label="Total Hours" value={fmtHours(s.totalHours)} />
        <SummaryStat label="Onsite / Remote" value={`${fmtHours(s.onsiteHours)} / ${fmtHours(s.remoteHours)}`} />
        <SummaryStat label="Billable Hours" value={fmtHours(s.billableHours)} />
        <SummaryStat
          label="Compliance"
          value={fmtPct(s.complianceRate)}
          tone={s.isCompliant ? "emerald" : "rose"}
        />
      </div>

      {/* Table */}
      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Project</th>
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Mode</th>
                <th className="px-4 py-3 text-right font-medium">Onsite</th>
                <th className="px-4 py-3 text-right font-medium">Hours</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    <Loader2 size={20} className="mx-auto animate-spin" />
                  </td>
                </tr>
              ) : report.lines.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    No entries match these filters.
                  </td>
                </tr>
              ) : (
                report.lines.map((l) => (
                  <tr key={l.id} className="border-b border-white/5 transition-colors hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-slate-300">{fmtDate(l.workDate)}</td>
                    <td className="px-4 py-3 text-white">{l.user}</td>
                    <td className="px-4 py-3 text-slate-400">{l.customer}</td>
                    <td className="px-4 py-3 text-slate-300">{l.project}</td>
                    <td className="px-4 py-3 text-slate-400">{l.taskType.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-slate-400">{l.workMode}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{fmtHours(l.onsiteHours)}</td>
                    <td className="px-4 py-3 text-right text-white">{fmtHours(l.hours)}</td>
                    <td className="px-4 py-3"><Badge tone={statusTone(l.status)}>{l.status}</Badge></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </PageContainer>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "rose";
}) {
  return (
    <GlassCard className="p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={
          "mt-1 text-xl font-bold " +
          (tone === "emerald" ? "text-emerald-300" : tone === "rose" ? "text-rose-300" : "text-white")
        }
      >
        {value}
      </p>
    </GlassCard>
  );
}
