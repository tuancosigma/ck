"use client";

// Month calendar showing each day's logged status with color coding.

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { fromDateKey } from "@/lib/payroll-period";
import type { DayStatus } from "@/lib/data/timesheet";

const STATUS_STYLE: Record<DayStatus, string> = {
  APPROVED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  DRAFT: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  SUBMITTED: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
  REJECTED: "bg-rose-500/20 text-rose-300 border-rose-500/50",
  MISSING: "bg-rose-500/10 text-rose-400/80 border-rose-500/30 border-dashed",
  LEAVE: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  WEEKEND: "bg-transparent text-slate-600 border-white/5",
  FUTURE: "bg-transparent text-slate-500 border-white/5",
};

const LEGEND: { status: DayStatus; label: string }[] = [
  { status: "APPROVED", label: "Approved" },
  { status: "DRAFT", label: "Draft" },
  { status: "SUBMITTED", label: "Submitted" },
  { status: "MISSING", label: "Missing" },
  { status: "REJECTED", label: "Rejected" },
  { status: "LEAVE", label: "Leave/Holiday" },
];

export function CalendarGrid({
  days,
  selected,
  onSelect,
}: {
  days: { date: string; status: DayStatus; hours: number }[];
  selected: string;
  onSelect: (date: string) => void;
}) {
  // Pad leading blanks so the first day lands under the right weekday column.
  const first = days[0] ? fromDateKey(days[0].date) : new Date();
  const leadingBlanks = first.getDay();

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {days.map((d) => {
          const day = fromDateKey(d.date).getDate();
          const isSelected = d.date === selected;
          return (
            <motion.button
              key={d.date}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(d.date)}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-lg border text-sm transition-colors",
                STATUS_STYLE[d.status],
                isSelected && "ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-950"
              )}
            >
              <span className="font-medium">{day}</span>
              {d.hours > 0 && (
                <span className="text-[9px] opacity-70">{d.hours}h</span>
              )}
            </motion.button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        {LEGEND.map((l) => (
          <span key={l.status} className="flex items-center gap-1.5 text-xs text-slate-400">
            <span
              className={cn(
                "h-3 w-3 rounded border",
                STATUS_STYLE[l.status]
              )}
            />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
