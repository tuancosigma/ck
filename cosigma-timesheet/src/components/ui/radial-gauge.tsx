"use client";

// Animated circular progress ring with neon glow. The stroke-dashoffset
// springs from empty to its target on mount. A pulsing status light sits in the
// centre: steady green pulse when compliant, breathing red/orange when not.

import { motion } from "framer-motion";

interface Props {
  /** 0..1 progress value. */
  value: number;
  size?: number;
  stroke?: number;
  /** When true uses emerald (compliant); otherwise rose/orange (non-compliant). */
  compliant: boolean;
  label?: string;
  sublabel?: string;
  /** Extra detail line, e.g. "2 onsite days remaining". */
  detail?: string;
}

export function RadialGauge({
  value,
  size = 200,
  stroke = 16,
  compliant,
  label,
  sublabel,
  detail,
}: Props) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, value));
  const offset = circumference * (1 - clamped);

  const gradId = compliant ? "grad-emerald" : "grad-rose";
  const glow = compliant
    ? "drop-shadow(0 0 10px rgba(16,185,129,0.6))"
    : "drop-shadow(0 0 10px rgba(244,63,94,0.6))";

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="grad-emerald" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
          <linearGradient id="grad-rose" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#fb923c" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ type: "spring", stiffness: 60, damping: 18, delay: 0.2 }}
          style={{ filter: glow }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {/* Pulsing status light */}
        <motion.span
          className="mb-1.5 h-2.5 w-2.5 rounded-full"
          style={{
            backgroundColor: compliant ? "#34d399" : "#fb7185",
            boxShadow: compliant
              ? "0 0 12px rgba(52,211,153,0.9)"
              : "0 0 12px rgba(251,113,133,0.9)",
          }}
          animate={
            compliant
              ? { opacity: [1, 0.4, 1], scale: [1, 1.2, 1] }
              : { opacity: [1, 0.3, 1], scale: [1, 1.4, 1] }
          }
          transition={{ duration: compliant ? 2 : 1.2, repeat: Infinity, ease: "easeInOut" }}
        />
        {label && <span className="text-3xl font-bold text-white">{label}</span>}
        {sublabel && (
          <span className="mt-1 text-xs uppercase tracking-wide text-slate-400">
            {sublabel}
          </span>
        )}
        {detail && (
          <span className="mt-1 max-w-[8rem] text-[11px] leading-tight text-slate-500">
            {detail}
          </span>
        )}
      </div>
    </div>
  );
}
