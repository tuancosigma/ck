"use client";

import { useRouter } from "next/navigation";

import { Clock, FileEdit, Plane, AlertTriangle, Building2 } from "lucide-react";
import { PageContainer, StaggerList, StaggerItem } from "@/components/ui/motion";
import { GlassCard } from "@/components/ui/glass-card";
import { RadialGauge } from "@/components/ui/radial-gauge";
import { Badge, statusTone } from "@/components/ui/badge";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { HoursBarChart } from "@/components/dashboard/hours-bar-chart";
import { MicroWarnings } from "@/components/dashboard/micro-warnings";
import { GsapReveal } from "@/components/ui/gsap-reveal";
import { AttendanceHeatmap } from "@/components/timesheet/attendance-heatmap";
import { fmtDate, fmtHours, fmtPct } from "@/lib/format";
import type { DashboardData } from "@/lib/data/dashboard";

export function DashboardView({
  data,
  userName,
}: {
  data: DashboardData;
  userName: string;
}) {
  const c = data.compliance;
  const router = useRouter();

  // Clicking a chart bar jumps to that day on the timesheet page.
  const onBarClick = (date: string) => router.push(`/timesheet?date=${date}`);

  return (
    <PageContainer className="space-y-6">
      <MicroWarnings warnings={data.warnings} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {userName.split(" ")[0]}
          </h1>
          <p className="text-sm text-slate-400">
            Payroll period · {data.periodLabel} (25th – 24th)
          </p>
        </div>
        <Badge tone={c.isCompliant ? "emerald" : "rose"} pulse={!c.isCompliant}>
          {c.isCompliant ? "Onsite Compliant" : "Action Needed"}
        </Badge>
      </header>

      {/* KPI row */}
      <StaggerList className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Building2}
          accent={c.isCompliant ? "emerald" : "rose"}
          label="Onsite Compliance"
          value={fmtPct(c.rate)}
          sub={`${c.actualOnsiteDays}/${c.requiredOnsiteDays} required onsite days`}
          warning={!c.isCompliant}
        />
        <KpiCard
          icon={Clock}
          accent={data.underTarget ? "amber" : "indigo"}
          label="Hours Logged"
          value={fmtHours(data.totalHours)}
          sub={`Target ${fmtHours(data.targetHours)} this period`}
          warning={data.underTarget}
        />
        <KpiCard
          icon={FileEdit}
          accent="amber"
          label="Pending Drafts"
          value={String(data.pendingDrafts)}
          sub="Awaiting submission"
          warning={data.pendingDrafts > 0}
        />
        <KpiCard
          icon={Plane}
          accent="emerald"
          label="Annual Leave"
          value={`${data.remainingLeave}d`}
          sub="Remaining this year"
        />
      </StaggerList>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Compliance gauge */}
        <GlassCard className="flex flex-col items-center justify-center p-6 lg:col-span-1">
          <h2 className="mb-4 self-start text-sm font-semibold uppercase tracking-wide text-slate-400">
            Onsite Compliance
          </h2>
          <RadialGauge
            value={c.rate}
            compliant={c.isCompliant}
            label={fmtPct(c.rate)}
            sublabel={c.isCompliant ? "Compliant" : "Below target"}
            detail={
              c.isCompliant
                ? "On track this period"
                : `${c.onsiteDaysRemaining} onsite ${c.onsiteDaysRemaining === 1 ? "day" : "days"} remaining`
            }
          />
          <p className="mt-4 text-center text-sm text-slate-400">
            {c.actualOnsiteDays} onsite days of {c.requiredOnsiteDays} required
            <br />
            <span className="text-xs text-slate-500">
              {c.workingDays} working days in period
            </span>
          </p>
        </GlassCard>

        {/* Missing timesheet alerts */}
        <GlassCard className="p-6 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-rose-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Missing Timesheets
            </h2>
            {data.missingDays.length > 0 && (
              <Badge tone="rose" pulse>
                {data.missingDays.length} days
              </Badge>
            )}
          </div>

          {data.missingDays.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-sm text-emerald-300">
              All caught up — no missing logs in this period.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.missingDays.map((d) => (
                <span
                  key={d}
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition-all hover:border-rose-400/60"
                >
                  {fmtDate(d)}
                </span>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Attendance heatmap */}
      <GsapReveal>
        <GlassCard className="p-6">
          <AttendanceHeatmap data={data.heatmap} />
        </GlassCard>
      </GsapReveal>

      {/* Hours bar chart */}
      <GsapReveal>
        <GlassCard className="p-6">
          <HoursBarChart data={data.dailyHours} onBarClick={onBarClick} />
        </GlassCard>
      </GsapReveal>

      {/* Recent entries */}
      <GsapReveal>
        <GlassCard className="p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Recent Activity
          </h2>
        {data.recentEntries.length === 0 ? (
          <p className="text-sm text-slate-500">No entries yet this period.</p>
        ) : (
          <StaggerList className="space-y-2">
            {data.recentEntries.map((e) => (
              <StaggerItem key={e.id}>
                <div className="gradient-border flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 transition-all duration-300 hover:bg-white/[0.04]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {e.project}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {e.customer} · {fmtDate(e.workDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-300">{fmtHours(e.hours)}</span>
                    <Badge tone={statusTone(e.status)}>{e.status}</Badge>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerList>
        )}
        </GlassCard>
      </GsapReveal>
    </PageContainer>
  );
}
