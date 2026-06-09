"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  CalendarClock,
  CheckSquare,
  FileBarChart,
  LogOut,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import type { SessionUser } from "@/lib/auth";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "MANAGER", "EMPLOYEE"] },
  { href: "/timesheet", label: "My Timesheet", icon: CalendarClock, roles: ["ADMIN", "MANAGER", "EMPLOYEE"] },
  { href: "/approvals", label: "Approvals", icon: CheckSquare, roles: ["ADMIN", "MANAGER"] },
  { href: "/reports", label: "Reports", icon: FileBarChart, roles: ["ADMIN", "MANAGER", "EMPLOYEE"] },
];

const roleTone: Record<string, string> = {
  ADMIN: "from-rose-500 to-orange-500",
  MANAGER: "from-indigo-500 to-violet-600",
  EMPLOYEE: "from-emerald-400 to-teal-500",
};

export function Sidebar({ user }: { user: SessionUser }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const items = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <motion.aside
      animate={{ width: collapsed ? 80 : 256 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
      className="glass-strong sticky top-0 z-30 flex h-screen flex-col border-r border-white/5 px-3 py-5"
    >
      {/* Brand */}
      <div className="mb-8 flex items-center gap-3 px-2">
        <motion.div
          whileHover={{ rotate: 8, scale: 1.08 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
          className="shrink-0"
        >
          <Image
            src="/brand/cosigma-logo-transparent.png"
            alt="Cosigma logo"
            width={40}
            height={40}
            priority
            className="drop-shadow-[0_0_6px_rgba(99,102,241,0.4)] transition-all duration-300 hover:drop-shadow-[0_0_14px_rgba(99,102,241,0.75)]"
          />
        </motion.div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="whitespace-nowrap text-lg font-bold tracking-tight"
            >
              Cosigma
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1.5">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300",
                active
                  ? "bg-indigo-500/10 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-indigo-400 to-violet-500 shadow-[0_0_12px_rgba(99,102,241,0.8)]"
                />
              )}
              <Icon
                size={20}
                className={cn(
                  "shrink-0 transition-all",
                  active && "drop-shadow-[0_0_8px_rgba(99,102,241,0.7)]"
                )}
              />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="mb-3 flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-500 hover:bg-white/5 hover:text-white"
      >
        <ChevronLeft
          size={20}
          className={cn("shrink-0 transition-transform", collapsed && "rotate-180")}
        />
        {!collapsed && <span>Collapse</span>}
      </button>

      {/* Profile footer */}
      <div className="border-t border-white/5 pt-3">
        <div className="flex items-center gap-3 px-1">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white",
              roleTone[user.role]
            )}
          >
            {initials(user.name)}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="min-w-0 flex-1"
              >
                <p className="truncate text-sm font-medium text-white">{user.name}</p>
                <p className="truncate text-xs text-slate-500">{user.role}</p>
              </motion.div>
            )}
          </AnimatePresence>
          {!collapsed && (
            <button
              onClick={logout}
              title="Log out"
              className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
