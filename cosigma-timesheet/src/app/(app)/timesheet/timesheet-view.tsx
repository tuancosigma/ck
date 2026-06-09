"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { PageContainer, StaggerList, StaggerItem } from "@/components/ui/motion";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge, statusTone } from "@/components/ui/badge";
import { CalendarGrid } from "@/components/timesheet/calendar-grid";
import { EntryForm } from "@/components/timesheet/entry-form";
import { fmtDate, fmtHours } from "@/lib/format";
import { toDateKey } from "@/lib/payroll-period";
import type { TimesheetPageData } from "@/lib/data/timesheet";

export function TimesheetView({ data }: { data: TimesheetPageData }) {
  const router = useRouter();

  // Default selection: today if inside the period, else the most recent day.
  const todayKey = toDateKey(new Date());
  const initial = data.days.some((d) => d.date === todayKey)
    ? todayKey
    : data.days[data.days.length - 1]?.date ?? todayKey;

  const [selected, setSelected] = useState(initial);

  const existing = useMemo(
    () => data.entries.find((e) => e.workDate === selected) ?? null,
    [data.entries, selected]
  );

  return (
    <PageContainer className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">My Timesheet</h1>
        <p className="text-sm text-slate-400">
          Payroll period · {data.periodLabel}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Calendar + entries (left, wider) */}
        <div className="space-y-6 lg:col-span-3">
          <GlassCard className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <CalendarDays size={18} className="text-indigo-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Calendar
              </h2>
            </div>
            <CalendarGrid days={data.days} selected={selected} onSelect={setSelected} />
          </GlassCard>

          <GlassCard className="p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Entries This Period
            </h2>
            {data.entries.length === 0 ? (
              <p className="text-sm text-slate-500">No entries yet.</p>
            ) : (
              <StaggerList className="space-y-2">
                {data.entries.map((e) => (
                  <StaggerItem key={e.id}>
                    <button
                      onClick={() => setSelected(e.workDate)}
                      className="flex w-full items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-left transition-all duration-300 hover:border-indigo-500/40 hover:bg-white/[0.04]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {e.projectName}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {fmtDate(e.workDate)} · {e.workMode} · {e.taskType.replace("_", " ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-300">{fmtHours(e.hours)}</span>
                        <Badge tone={statusTone(e.status)}>{e.status}</Badge>
                      </div>
                    </button>
                  </StaggerItem>
                ))}
              </StaggerList>
            )}
          </GlassCard>
        </div>

        {/* Smart entry form (right, sticky) */}
        <div className="lg:col-span-2">
          <GlassCard className="sticky top-8 p-6">
            <EntryForm
              selectedDate={selected}
              existing={existing}
              projects={data.projects}
              defaultWorkMode={data.defaultWorkMode}
              lastProjectId={data.lastProjectId}
              onSaved={() => router.refresh()}
            />
          </GlassCard>
        </div>
      </div>
    </PageContainer>
  );
}
