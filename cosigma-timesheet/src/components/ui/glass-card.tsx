"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// Frosted-glass surface. When `interactive` is set it lifts and glows on hover.
export function GlassCard({
  children,
  className,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  const base = cn(
    "glass rounded-2xl",
    interactive &&
      "transition-all duration-300 hover:border-indigo-500/50 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)]",
    className
  );

  if (!interactive) return <div className={base}>{children}</div>;

  return (
    <motion.div
      whileHover={{ scale: 1.02, translateY: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={base}
    >
      {children}
    </motion.div>
  );
}
