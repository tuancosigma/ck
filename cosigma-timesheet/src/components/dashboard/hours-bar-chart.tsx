"use client";

// SVG bar chart of logged hours across the payroll period. A tab switcher
// (Period / Recent) filters the dataset with a shared layoutId pill animation;
// bars spring up to height on mount and reflow on tab change.

import { useState } from "react";
import { motion } from "framer-motion";
import { fromDateKey } from "@/lib/payroll-period";

interface Day {
  date: string;
  hours: number;
  onsite: number;
  isToday: boolean;
}

const TABS = [
  { id: "period", label: "Full Period" },
  { id: "recent", label: "Recent 10" },
] as const;

const TARGET = 8;

export function HoursBarChart({ data }: { data: Day[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("period");

  const days = tab === "recent" ? data.slice(-10) : data;
  const max = Math.max(TARGET, ...days.map((d) => d.hours), 1);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Hours Logged
        </h2>
        <div className="flex gap-1 rounded-lg bg-white/5 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="relative rounded-md px-3 py-1 text-xs font-medium transition-colors"
            >
              {tab === t.id && (
                <motion.span
                  layoutId="chart-tab"
                  className="absolute inset-0 rounded-md bg-gradient-to-r from-indigo-500 to-violet-600"
                  transition={{ type: "spring", stiffness: 300, damping: 26 }}
                />
              )}
              <span className={tab === t.id ? "relative text-white" : "relative text-slate-400"}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex h-44 items-end gap-1.5">
        {days.map((d) => {
          const day = fromDateKey(d.date);
          const totalPct = (d.hours / max) * 100;
          const onsitePct = d.hours > 0 ? (d.onsite / d.hours) * 100 : 0;
          return (
            <div key={d.date} className="group flex flex-1 flex-col items-center gap-1">
              <div className="relative flex w-full flex-1 items-end">
                <motion.div
                  layout
                  initial={{ height: 0 }}
                  animate={{ height: `${totalPct}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 18 }}
                  className={
                    "relative w-full overflow-hidden rounded-t-md " +
                    (d.isToday
                      ? "bg-gradient-to-t from-indigo-500/40 to-violet-400/40 ring-1 ring-indigo-400/60"
                      : "bg-gradient-to-t from-indigo-500/25 to-violet-500/20")
                  }
                >
                  {/* Onsite portion highlighted at the base */}
                  <div
                    className="absolute bottom-0 w-full bg-gradient-to-t from-emerald-400/70 to-teal-400/40"
                    style={{ height: `${onsitePct}%` }}
                  />
                  {/* Tooltip */}
                  <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                    {d.hours}h · {d.onsite}h onsite
                  </span>
                </motion.div>
              </div>
              <span className="text-[9px] text-slate-500">{day.getDate()}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-gradient-to-t from-indigo-500/25 to-violet-500/20" />
          Total
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-emerald-400/70" />
          Onsite
        </span>
      </div>
    </div>
  );
}
