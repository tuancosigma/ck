"use client";

import React, { useState, useEffect } from "react";
import {
  Bell, Search, ChevronDown, User,
  ServerCrash, Key, AlertTriangle, CreditCard,
  CheckCircle, Settings, LogOut, Circle,
  Activity, X,
} from "lucide-react";
import CommandPalette from "./CommandPalette";
import { api } from "@/utils/api";
import { timeAgo } from "@/utils/helpers";

interface Notification {
  id: string;
  type: "failure" | "credential" | "api" | "worker" | "billing" | "success";
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const WORKSPACES = ["SecOps Core", "Dev Sandbox", "Production Flows"];

const severityStyles = {
  critical: "border-l-red-500 bg-red-500/5",
  warning:  "border-l-amber-500 bg-amber-500/5",
  info:     "border-l-blue-500 bg-blue-500/5",
};

const severityDot = {
  critical: "bg-red-500",
  warning:  "bg-amber-500",
  info:     "bg-blue-500",
};

function NotificationIcon({ type }: { type: string }) {
  switch (type) {
    case "failure":    return <ServerCrash className="w-4 h-4 text-red-400" />;
    case "worker":     return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    case "credential": return <Key className="w-4 h-4 text-blue-400" />;
    case "billing":    return <CreditCard className="w-4 h-4 text-purple-400" />;
    case "success":    return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    default:           return <Activity className="w-4 h-4 text-slate-400" />;
  }
}

export default function TopBar() {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState(WORKSPACES[0]);
  const [showWsMenu, setShowWsMenu] = useState(false);

  const fetchLiveNotifications = async () => {
    try {
      // Fetch dynamic failures from Prisma
      const failedExecs = await api.executions.list({ status: "FAILED", limit: 5 });
      
      let readIds: string[] = [];
      let dismissedIds: string[] = [];
      try {
        readIds = JSON.parse(localStorage.getItem("read_notifications") || "[]");
        dismissedIds = JSON.parse(localStorage.getItem("dismissed_notifications") || "[]");
      } catch (e) {}

      // Filter out dismissed notifications
      const activeFailures = failedExecs.filter((exec: any) => !dismissedIds.includes(exec.id));

      const realNotifications: Notification[] = activeFailures.map((exec: any) => ({
        id: exec.id,
        type: "failure",
        severity: "critical",
        title: "Workflow Failure",
        message: `${exec.workflow?.name || "Workflow"} failed — ${exec.error || "Unknown error"}`,
        time: timeAgo(exec.createdAt),
        read: readIds.includes(exec.id),
      }));

      // Fallback/info status if workspace is healthy
      if (realNotifications.length === 0) {
        realNotifications.push({
          id: "all-clear",
          type: "success",
          severity: "info",
          title: "All Systems Operational",
          message: "No active workflow failures or alerts in your workspace.",
          time: "Just now",
          read: true,
        });
      }

      setNotifications(realNotifications);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };

  useEffect(() => {
    fetchLiveNotifications();
    const interval = setInterval(fetchLiveNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;
  const criticalCount = notifications.filter(n => n.severity === "critical" && !n.read).length;

  // Cmd+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const markAllRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      const readIds = updated.map(n => n.id);
      localStorage.setItem("read_notifications", JSON.stringify(readIds));
      return updated;
    });
  };

  const dismiss = (id: string) => {
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id);
      try {
        const currentDismissed = JSON.parse(localStorage.getItem("dismissed_notifications") || "[]");
        if (!currentDismissed.includes(id)) {
          localStorage.setItem("dismissed_notifications", JSON.stringify([...currentDismissed, id]));
        }
      } catch (e) {}
      return updated;
    });
  };

  const criticals = notifications.filter(n => n.severity === "critical");
  const warnings  = notifications.filter(n => n.severity === "warning");
  const infos     = notifications.filter(n => n.severity === "info");

  return (
    <>
      <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} />

      <header className="h-14 border-b border-border/60 flex items-center justify-between px-6 z-20 sticky top-0 flex-shrink-0"
        style={{ background: "rgba(10, 13, 20, 0.95)", backdropFilter: "blur(12px)" }}>

        {/* ── Left: Workspace switcher ── */}
        <div className="relative">
          <button
            onClick={() => { setShowWsMenu(!showWsMenu); setShowNotifications(false); setShowUserMenu(false); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/60 hover:border-border bg-white/[0.03] hover:bg-white/[0.05] text-xs font-semibold text-white transition-all"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 pulse-dot" />
            <span>{activeWorkspace}</span>
            <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${showWsMenu ? "rotate-180" : ""}`} />
          </button>

          {showWsMenu && (
            <div className="absolute top-11 left-0 w-52 rounded-xl border border-border bg-card p-1.5 shadow-2xl z-40 animate-slide-down">
              {WORKSPACES.map(ws => (
                <button
                  key={ws}
                  onClick={() => { setActiveWorkspace(ws); setShowWsMenu(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    activeWorkspace === ws ? "text-primary bg-primary/5" : "text-slate-300 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  {ws}
                  {activeWorkspace === ws && <Circle className="w-1.5 h-1.5 fill-primary text-transparent" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Center: Cmd+K trigger ── */}
        <button
          onClick={() => setCmdOpen(true)}
          className="flex items-center gap-3 px-4 py-2 rounded-xl border border-border/50 bg-white/[0.03] hover:bg-white/[0.05] hover:border-border transition-all text-slate-500 hover:text-slate-300 group"
          style={{ width: "340px" }}
        >
          <Search className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1 text-left text-xs font-medium">Search workflows, agents, logs...</span>
          <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 bg-slate-800/60 border border-slate-700 rounded group-hover:text-slate-400 transition-colors">
            ⌘K
          </kbd>
        </button>

        {/* ── Right: Actions ── */}
        <div className="flex items-center gap-2">

          {/* System Status */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/5 border border-emerald-500/15 text-emerald-400">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
            <span className="text-[10px] font-bold uppercase tracking-wider">All Systems OK</span>
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false); setShowWsMenu(false); }}
              className="relative w-8 h-8 flex items-center justify-center rounded-lg border border-border/60 hover:border-border text-slate-400 hover:text-white hover:bg-white/[0.05] transition-all"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className={`absolute -top-1 -right-1 w-4 h-4 text-[9px] font-black text-white rounded-full flex items-center justify-center border border-background ${criticalCount > 0 ? "bg-red-500" : "bg-amber-500"}`}>
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute top-11 right-0 w-96 rounded-2xl border border-border bg-card shadow-2xl z-40 overflow-hidden animate-slide-down">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Notifications</span>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-[10px] text-primary hover:underline font-bold">Mark all read</button>
                    )}
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto divide-y divide-border/30">
                  {[
                    { label: "Critical", items: criticals, severity: "critical" },
                    { label: "Warnings", items: warnings, severity: "warning" },
                    { label: "Info", items: infos, severity: "info" },
                  ].map(({ label, items, severity }) =>
                    items.length > 0 ? (
                      <div key={severity}>
                        <p className="px-4 py-2 text-[9px] font-black text-slate-600 uppercase tracking-widest">{label}</p>
                        {items.map(n => (
                          <div
                            key={n.id}
                            className={`px-4 py-3 flex gap-3 border-l-2 ${severityStyles[n.severity]} ${n.read ? "opacity-50" : ""} hover:opacity-100 transition-all`}
                          >
                            <div className="mt-0.5 flex-shrink-0">
                              <NotificationIcon type={n.type} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start gap-2">
                                <span className="text-xs font-bold text-white">{n.title}</span>
                                <span className="text-[9px] text-slate-500 whitespace-nowrap">{n.time}</span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">{n.message}</p>
                            </div>
                            <button onClick={() => dismiss(n.id)} className="text-slate-600 hover:text-slate-400 flex-shrink-0 mt-0.5">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null
                  )}
                  {notifications.length === 0 && (
                    <div className="py-8 text-center text-slate-500 text-xs font-medium">All caught up ✓</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false); setShowWsMenu(false); }}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border border-border/60 hover:border-border bg-white/[0.03] hover:bg-white/[0.05] transition-all"
            >
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary/60 to-orange-500/40 border border-primary/20 flex items-center justify-center text-[9px] font-black text-white flex-shrink-0">
                FG
              </div>
              <div className="hidden lg:block text-left">
                <span className="text-[11px] font-semibold text-white leading-none block">Admin</span>
                <span className="text-[9px] text-slate-500 font-bold tracking-wide block mt-0.5">Owner</span>
              </div>
              <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${showUserMenu ? "rotate-180" : ""}`} />
            </button>

            {showUserMenu && (
              <div className="absolute top-11 right-0 w-48 rounded-xl border border-border bg-card p-1.5 shadow-2xl z-40 animate-slide-down">
                {[
                  { label: "Profile", icon: User, path: "/settings" },
                  { label: "Settings", icon: Settings, path: "/settings" },
                  { label: "Billing", icon: CreditCard, path: "/billing" },
                ].map(({ label, icon: Icon, path }) => (
                  <button key={label} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.04] transition-colors">
                    <Icon className="w-3.5 h-3.5 text-slate-500" />
                    {label}
                  </button>
                ))}
                <div className="border-t border-border/60 mt-1 pt-1">
                  <button
                    onClick={() => { localStorage.removeItem("token"); window.location.href = "/login"; }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
