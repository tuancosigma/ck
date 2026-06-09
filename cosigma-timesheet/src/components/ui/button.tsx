"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "success" | "danger" | "ghost" | "subtle";

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-900/30 hover:shadow-indigo-700/40",
  success:
    "bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-semibold shadow-lg shadow-emerald-900/30",
  danger:
    "bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-lg shadow-rose-900/30",
  ghost: "bg-white/5 text-slate-200 hover:bg-white/10 border border-white/10",
  subtle: "bg-transparent text-slate-400 hover:text-white hover:bg-white/5",
};

interface Props
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  className,
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        className
      )}
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
  );
}
