"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";

// Returns false during SSR / first hydration render, true afterwards — without
// a setState-in-effect. Lets us defer theme-dependent markup safely.
const noopSubscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const mounted = useHydrated();

  return (
    <motion.button
      onClick={toggle}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.9 }}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="glass flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 transition-colors hover:text-white"
    >
      {mounted && (
        <AnimatePresence mode="wait" initial={false}>
          {theme === "dark" ? (
            <motion.span
              key="moon"
              initial={{ rotate: -90, scale: 0, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 90, scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
            >
              <Moon size={18} />
            </motion.span>
          ) : (
            <motion.span
              key="sun"
              initial={{ rotate: 90, scale: 0, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: -90, scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
            >
              <Sun size={18} className="text-amber-400" />
            </motion.span>
          )}
        </AnimatePresence>
      )}
    </motion.button>
  );
}
