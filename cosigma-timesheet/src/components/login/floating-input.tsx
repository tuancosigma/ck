"use client";

// Input with a floating label that lifts and glows on focus / when filled,
// plus a spring-animated glowing border ring.

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export function FloatingInput({
  label,
  type = "text",
  value,
  onChange,
  required,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const active = focused || value.length > 0;

  return (
    <div className="relative">
      <motion.label
        animate={{
          y: active ? -10 : 12,
          scale: active ? 0.82 : 1,
          color: focused ? "#a5b4fc" : "#64748b",
        }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className="pointer-events-none absolute left-3.5 top-0 origin-left text-sm font-medium"
        style={{ textShadow: focused ? "0 0 12px rgba(99,102,241,0.6)" : "none" }}
      >
        {label}
      </motion.label>
      <motion.input
        type={type}
        value={value}
        required={required}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value)}
        animate={{
          boxShadow: focused
            ? "0 0 0 1px rgba(99,102,241,0.7), 0 0 20px rgba(99,102,241,0.3)"
            : "0 0 0 1px rgba(255,255,255,0.08)",
        }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className={cn(
          "w-full rounded-xl bg-slate-950/50 px-3.5 pb-2.5 pt-5 text-sm text-slate-50 outline-none"
        )}
      />
    </div>
  );
}
