import React from "react";

/**
 * Formats a timestamp into a human-readable relative time string.
 * Supports a customizable fallback if formatting fails.
 */
export function timeAgo(d: string, fallback = "—") {
  try {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch {
    return fallback;
  }
}

/**
 * Recharts Custom Tooltip Component.
 * Provides a sleek, dark-themed glassmorphism styled tooltip for charts.
 */
export const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-xl text-xs">
      <p className="text-slate-400 font-semibold mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-300 font-medium">{p.name}:</span>
          <span className="text-white font-bold tabular">{p.value}</span>
        </div>
      ))}
    </div>
  );
};
