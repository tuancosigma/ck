"use client";

import type { LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { StaggerItem } from "@/components/ui/motion";
import { cn } from "@/lib/cn";

type Accent = "indigo" | "emerald" | "rose" | "amber";

const accents: Record<Accent, string> = {
  indigo: "from-indigo-500/20 to-violet-600/10 text-indigo-300",
  emerald: "from-emerald-400/20 to-teal-500/10 text-emerald-300",
  rose: "from-rose-500/20 to-orange-500/10 text-rose-300",
  amber: "from-amber-400/20 to-orange-500/10 text-amber-300",
};

export function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = "indigo",
  warning = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  accent?: Accent;
  warning?: boolean;
}) {
  return (
    <StaggerItem>
      <GlassCard interactive className="h-full p-5">
        <div className="flex items-start justify-between">
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br",
              accents[accent]
            )}
          >
            <Icon size={22} />
          </div>
          {warning && (
            <span className="halo-pulse h-2.5 w-2.5 rounded-full bg-rose-500" />
          )}
        </div>
        <p className="mt-4 text-2xl font-bold text-white">{value}</p>
        <p className="mt-0.5 text-sm font-medium text-slate-300">{label}</p>
        {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
      </GlassCard>
    </StaggerItem>
  );
}
