import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "indigo" | "emerald" | "rose" | "amber" | "slate";

const tones: Record<Tone, string> = {
  indigo: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  rose: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  slate: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

export function Badge({
  children,
  tone = "slate",
  pulse = false,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        pulse && "halo-pulse",
        className
      )}
    >
      {children}
    </span>
  );
}

// Status tone mapping for timesheet statuses.
export function statusTone(status: string): Tone {
  switch (status) {
    case "APPROVED":
      return "emerald";
    case "SUBMITTED":
      return "indigo";
    case "REJECTED":
      return "rose";
    case "DRAFT":
    default:
      return "slate";
  }
}
