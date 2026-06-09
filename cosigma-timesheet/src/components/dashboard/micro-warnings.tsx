"use client";

// Floating policy-violation banners that slide in from the top-right with a
// spring bounce, stagger on mount, and can be dismissed individually.

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

export function MicroWarnings({
  warnings,
}: {
  warnings: { id: string; message: string }[];
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = warnings.filter((w) => !dismissed.has(w.id));

  return (
    <div className="pointer-events-none fixed right-5 top-5 z-50 flex w-80 flex-col gap-2">
      <AnimatePresence>
        {visible.map((w, i) => (
          <motion.div
            key={w.id}
            layout
            initial={{ opacity: 0, x: 120, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 120, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 320, damping: 22, delay: i * 0.08 }}
            className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-950/70 p-3 backdrop-blur-xl shadow-[0_0_24px_rgba(244,63,94,0.18)]"
          >
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-400" />
            <p className="flex-1 text-xs leading-snug text-rose-100">{w.message}</p>
            <button
              onClick={() => setDismissed((p) => new Set(p).add(w.id))}
              className="shrink-0 rounded p-0.5 text-rose-300/70 hover:bg-white/10 hover:text-white"
            >
              <X size={13} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
