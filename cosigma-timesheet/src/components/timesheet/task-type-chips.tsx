"use client";

// Task-type selector rendered as interactive chips with glowing icon badges.

import { motion } from "framer-motion";
import {
  Code,
  Users,
  Bug,
  GitPullRequest,
  FlaskConical,
  FileText,
  LifeBuoy,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface Meta {
  id: string;
  label: string;
  icon: LucideIcon;
  glow: string;
}

const TASKS: Meta[] = [
  { id: "DEVELOPMENT", label: "Development", icon: Code, glow: "rgba(99,102,241,0.6)" },
  { id: "MEETING", label: "Meeting", icon: Users, glow: "rgba(168,85,247,0.6)" },
  { id: "BUG_FIX", label: "Bug Fix", icon: Bug, glow: "rgba(244,63,94,0.6)" },
  { id: "CODE_REVIEW", label: "Code Review", icon: GitPullRequest, glow: "rgba(34,211,238,0.6)" },
  { id: "TESTING", label: "Testing", icon: FlaskConical, glow: "rgba(16,185,129,0.6)" },
  { id: "DOCUMENTATION", label: "Docs", icon: FileText, glow: "rgba(251,191,36,0.6)" },
  { id: "SUPPORT", label: "Support", icon: LifeBuoy, glow: "rgba(56,189,248,0.6)" },
  { id: "OTHER", label: "Other", icon: MoreHorizontal, glow: "rgba(148,163,184,0.6)" },
];

export function TaskTypeChips({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {TASKS.map((t) => {
        const Icon = t.icon;
        const active = t.id === value;
        return (
          <motion.button
            key={t.id}
            type="button"
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange(t.id)}
            animate={{
              borderColor: active ? t.glow : "rgba(255,255,255,0.08)",
            }}
            style={{ boxShadow: active ? `0 0 16px ${t.glow}` : "none" }}
            className={cn(
              "flex items-center gap-1.5 rounded-xl border bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium transition-colors",
              active ? "text-white" : "text-slate-400 hover:text-white"
            )}
          >
            <span
              className="flex h-5 w-5 items-center justify-center rounded-md"
              style={{
                background: active
                  ? `radial-gradient(circle, ${t.glow}, transparent 75%)`
                  : "transparent",
              }}
            >
              <Icon size={14} />
            </span>
            {t.label}
          </motion.button>
        );
      })}
    </div>
  );
}
