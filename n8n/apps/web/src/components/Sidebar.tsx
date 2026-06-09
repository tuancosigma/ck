"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  GitBranch,
  Key,
  History,
  Bot,
  Compass,
  CreditCard,
  Settings,
  LogOut,
  ShieldCheck,
  Activity,
  ChevronDown,
  Plus,
  Check,
} from "lucide-react";

const NAV_SECTIONS = [
  {
    label: "Overview",
    items: [
      { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
      { name: "Observability", path: "/observability", icon: Activity },
    ],
  },
  {
    label: "Automation",
    items: [
      { name: "Workflows", path: "/workflows", icon: GitBranch },
      { name: "Executions", path: "/executions", icon: History },
      { name: "AI Agents", path: "/agents", icon: Bot },
      { name: "Credentials", path: "/credentials", icon: Key },
    ],
  },
  {
    label: "Discover",
    items: [
      { name: "Marketplace", path: "/marketplace", icon: Compass },
    ],
  },
  {
    label: "Account",
    items: [
      { name: "Billing", path: "/billing", icon: CreditCard },
      { name: "Settings", path: "/settings", icon: Settings },
    ],
  },
];

const WORKSPACES = ["SecOps Core", "Dev Sandbox", "Production Flows"];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [wsOpen, setWsOpen] = useState(false);
  const [activeWs, setActiveWs] = useState(WORKSPACES[0]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  return (
    <aside className="w-60 flex-shrink-0 border-r border-border flex flex-col h-screen select-none overflow-hidden"
      style={{ background: "rgba(10, 13, 20, 0.98)" }}>

      {/* ── Brand ── */}
      <div className="px-4 pt-5 pb-4 border-b border-border/60 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center shadow-lg shadow-primary/25 flex-shrink-0">
          <ShieldCheck className="w-4.5 h-4.5 text-white" />
        </div>
        <div>
          <span className="text-[13px] font-black tracking-wide text-white leading-none block">F-GUARD</span>
          <span className="text-[9px] text-primary/80 font-bold tracking-widest uppercase block mt-0.5">Enterprise</span>
        </div>
      </div>

      {/* ── Workspace Switcher ── */}
      <div className="px-3 py-3 border-b border-border/40 relative">
        <button
          onClick={() => setWsOpen(!wsOpen)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-border/60 hover:border-border bg-white/[0.03] hover:bg-white/[0.05] transition-all text-left group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 pulse-dot" />
            <span className="text-xs font-semibold text-white truncate">{activeWs}</span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-500 flex-shrink-0 transition-transform duration-200 ${wsOpen ? "rotate-180" : ""}`} />
        </button>

        {wsOpen && (
          <div className="absolute top-full left-3 right-3 mt-1 rounded-xl border border-border bg-card shadow-2xl z-50 overflow-hidden animate-slide-down">
            {WORKSPACES.map((ws) => (
              <button
                key={ws}
                onClick={() => { setActiveWs(ws); setWsOpen(false); }}
                className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-left hover:bg-white/[0.04] transition-colors"
              >
                <span className={activeWs === ws ? "text-primary" : "text-slate-400"}>{ws}</span>
                {activeWs === ws && <Check className="w-3 h-3 text-primary" />}
              </button>
            ))}
            <div className="border-t border-border/60 p-1.5">
              <button className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-slate-400 hover:text-slate-300 hover:bg-white/[0.035] rounded-lg transition-colors">
                <Plus className="w-3 h-3" />
                New workspace
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4 scrollbar-thin">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-1 text-[9px] font-bold text-slate-600 uppercase tracking-widest">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.path ||
                  (item.path !== "/" && pathname.startsWith(item.path));

                return (
                  <button
                    key={item.path}
                    onClick={() => router.push(item.path)}
                    className={`nav-item ${isActive ? "nav-item-active" : "nav-item-default"}`}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary" />
                    )}
                    <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${isActive ? "text-primary" : "text-slate-500"}`} />
                    <span className={`text-[13px] ${isActive ? "text-white font-semibold" : "text-slate-500 font-medium"}`}>
                      {item.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── User / Sign Out ── */}
      <div className="p-3 border-t border-border/60">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/60 to-orange-500/40 border border-primary/20 flex items-center justify-center text-[10px] font-black text-white flex-shrink-0">
            FG
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[12px] font-semibold text-white block truncate leading-none">Admin F-GUARD</span>
            <span className="text-[9px] text-slate-500 font-bold tracking-wider uppercase block mt-0.5">Owner</span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full nav-item nav-item-default text-slate-500 hover:text-red-400 hover:bg-red-500/5"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-[13px]">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
