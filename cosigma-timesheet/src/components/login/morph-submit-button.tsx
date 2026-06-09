"use client";

// Submit button that morphs through three states:
//   idle   -> full-width gradient pill
//   loading-> collapses to a circular spinner
//   success-> green checkmark with a radial particle burst

import { motion, AnimatePresence } from "framer-motion";
import { Check, LogIn, Loader2 } from "lucide-react";

export type SubmitState = "idle" | "loading" | "success";

const BURST = Array.from({ length: 10 }, (_, i) => i);

export function MorphSubmitButton({
  state,
  onClick,
}: {
  state: SubmitState;
  onClick?: () => void;
}) {
  const compact = state !== "idle";

  return (
    <div className="flex justify-center">
      <motion.button
        type="submit"
        onClick={onClick}
        disabled={compact}
        layout
        animate={{
          width: compact ? 52 : "100%",
          borderRadius: compact ? 26 : 12,
          backgroundColor: state === "success" ? "#10b981" : "#6366f1",
        }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        whileHover={state === "idle" ? { scale: 1.02 } : undefined}
        whileTap={state === "idle" ? { scale: 0.98 } : undefined}
        className="relative flex h-[52px] items-center justify-center overflow-visible bg-gradient-to-r from-indigo-500 to-violet-600 text-sm font-medium text-white shadow-lg shadow-indigo-900/30"
      >
        <AnimatePresence mode="wait">
          {state === "idle" && (
            <motion.span
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <LogIn size={18} /> Sign in
            </motion.span>
          )}
          {state === "loading" && (
            <motion.span
              key="loading"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0 }}
            >
              <Loader2 size={22} className="animate-spin" />
            </motion.span>
          )}
          {state === "success" && (
            <motion.span
              key="success"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
              <Check size={24} strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>

        {/* Particle burst on success */}
        {state === "success" &&
          BURST.map((i) => {
            const angle = (i / BURST.length) * Math.PI * 2;
            return (
              <motion.span
                key={i}
                className="absolute h-1.5 w-1.5 rounded-full bg-emerald-300"
                initial={{ x: 0, y: 0, opacity: 1 }}
                animate={{
                  x: Math.cos(angle) * 46,
                  y: Math.sin(angle) * 46,
                  opacity: 0,
                  scale: 0.4,
                }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
            );
          })}
      </motion.button>
    </div>
  );
}
