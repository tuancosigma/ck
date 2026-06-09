"use client";

// GitHub-style attendance heatmap: last ~6 months of Mon-Fri days arranged into
// weekly columns, colour-coded by work mode with a hover tooltip per day.

import { fromDateKey } from "@/lib/payroll-period";
import type { HeatDay, HeatStatus } from "@/lib/data/dashboard";

const STATUS_COLOR: Record<HeatStatus, string> = {
  ONSITE: "bg-emerald-500/80",
  WFH: "bg-cyan-500/80",
  HYBRID: "bg-amber-500/80",
  OTHER: "bg-violet-500/60",
  MISSING: "bg-slate-500/20",
};

const STATUS_LABEL: Record<HeatStatus, string> = {
  ONSITE: "Onsite",
  WFH: "WFH",
  HYBRID: "Hybrid",
  OTHER: "Logged",
  MISSING: "No log",
};

const LEGEND: { status: HeatStatus; label: string }[] = [
  { status: "ONSITE", label: "Onsite" },
  { status: "WFH", label: "WFH" },
  { status: "HYBRID", label: "Hybrid" },
  { status: "MISSING", label: "Missing" },
];

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

// Mon=0 … Fri=4 (input is already weekdays only).
function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function AttendanceHeatmap({ data }: { data: HeatDay[] }) {
  // Group days into weekly columns keyed by the Monday of each week.
  const columns = new Map<string, (HeatDay | null)[]>();
  for (const day of data) {
    const d = fromDateKey(day.date);
    const wd = weekdayIndex(d);
    const monday = new Date(d);
    monday.setDate(d.getDate() - wd);
    const key = monday.toISOString().slice(0, 10);
    if (!columns.has(key)) columns.set(key, [null, null, null, null, null]);
    columns.get(key)![wd] = day;
  }
  const weekKeys = [...columns.keys()].sort();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Attendance · Last 6 Months
        </h2>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {LEGEND.map((l) => (
            <span key={l.status} className="flex items-center gap-1 text-[11px] text-slate-400">
              <span className={`h-2.5 w-2.5 rounded-[2px] ${STATUS_COLOR[l.status]}`} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {/* Weekday row labels */}
        <div className="flex shrink-0 flex-col gap-[3px] pr-1 pt-[1px]">
          {WEEKDAY_LABELS.map((w) => (
            <span key={w} className="h-[10px] text-[8px] leading-[10px] text-slate-500">
              {w}
            </span>
          ))}
        </div>

        {/* Weekly columns */}
        <div className="flex gap-[3px]">
          {weekKeys.map((wk) => (
            <div key={wk} className="flex flex-col gap-[3px]">
              {columns.get(wk)!.map((day, i) =>
                day ? (
                  <div key={i} className="group relative">
                    <div
                      className={`h-[10px] w-[10px] rounded-[2px] ${STATUS_COLOR[day.status]} transition-transform hover:scale-150`}
                    />
                    {/* Tooltip */}
                    <div className="pointer-events-none absolute bottom-[14px] left-1/2 z-30 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] text-white shadow-lg group-hover:block">
                      Date: {fromDateKey(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {"  |  "}Mode: {STATUS_LABEL[day.status]}
                      {"  |  "}Hours: {day.hours}h
                    </div>
                  </div>
                ) : (
                  <div key={i} className="h-[10px] w-[10px] rounded-[2px] bg-transparent" />
                )
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
