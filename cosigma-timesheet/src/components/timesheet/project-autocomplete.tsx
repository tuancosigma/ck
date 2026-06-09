"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Check } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ProjectOption {
  projectId: string;
  customerId: string;
  name: string;
  code: string;
  customerName: string;
}

export function ProjectAutocomplete({
  projects,
  value,
  onChange,
}: {
  projects: ProjectOption[];
  value: string;
  onChange: (projectId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = projects.find((p) => p.projectId === value);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = projects.filter((p) => {
    const q = query.toLowerCase();
    return (
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.customerName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
        />
        <input
          value={open ? query : selected ? `${selected.name} · ${selected.customerName}` : query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setQuery("");
            setOpen(true);
          }}
          placeholder="Search projects…"
          className="input-glow w-full rounded-xl border border-white/10 bg-slate-950/50 py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500"
        />
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="glass-strong absolute z-20 mt-2 max-h-60 w-full overflow-y-auto rounded-xl p-1.5"
          >
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-500">No projects found.</p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.projectId}
                  onClick={() => {
                    onChange(p.projectId);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-indigo-500/10",
                    p.projectId === value && "bg-indigo-500/10"
                  )}
                >
                  <span>
                    <span className="font-medium text-white">{p.name}</span>
                    <span className="ml-2 text-xs text-slate-500">{p.customerName}</span>
                  </span>
                  {p.projectId === value && (
                    <Check size={16} className="text-indigo-400" />
                  )}
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
