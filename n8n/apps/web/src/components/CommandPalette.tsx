"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, LayoutDashboard, GitBranch, History, Bot, Compass,
  CreditCard, Settings, Activity, Key, ArrowRight, Hash,
  Plus,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  category: string;
  keywords?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workflows?: Array<{ id: string; name: string }>;
}

export default function CommandPalette({ isOpen, onClose, workflows = [] }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const navigate = useCallback((path: string) => {
    router.push(path);
    onClose();
  }, [router, onClose]);

  const staticItems: CommandItem[] = [
    { id: "dashboard",    label: "Dashboard",     description: "System overview",      icon: LayoutDashboard, action: () => navigate("/dashboard"),     category: "Pages" },
    { id: "workflows",    label: "Workflows",     description: "Manage workflows",     icon: GitBranch,       action: () => navigate("/workflows"),     category: "Pages" },
    { id: "executions",   label: "Executions",    description: "Execution history",    icon: History,         action: () => navigate("/executions"),    category: "Pages" },
    { id: "agents",       label: "AI Agents",     description: "Agent management",     icon: Bot,             action: () => navigate("/agents"),        category: "Pages" },
    { id: "observ",       label: "Observability", description: "System metrics",       icon: Activity,        action: () => navigate("/observability"), category: "Pages" },
    { id: "marketplace",  label: "Marketplace",   description: "Browse templates",     icon: Compass,         action: () => navigate("/marketplace"),   category: "Pages" },
    { id: "credentials",  label: "Credentials",   description: "API keys & secrets",   icon: Key,             action: () => navigate("/credentials"),   category: "Pages" },
    { id: "billing",      label: "Billing",       description: "Plans & invoices",     icon: CreditCard,      action: () => navigate("/billing"),       category: "Pages" },
    { id: "settings",     label: "Settings",      description: "Workspace settings",   icon: Settings,        action: () => navigate("/settings"),      category: "Pages" },
    { id: "new-workflow", label: "New Workflow",   description: "Create blank workflow",icon: Plus,            action: () => navigate("/workflows"),     category: "Actions", keywords: "create add" },
  ];

  const workflowItems: CommandItem[] = workflows.map(w => ({
    id: `wf-${w.id}`,
    label: w.name,
    description: "Open workflow",
    icon: GitBranch,
    action: () => navigate(`/workflows/${w.id}/editor`),
    category: "Workflows",
  }));

  const allItems = [...staticItems, ...workflowItems];

  const filtered = query.trim() === ""
    ? staticItems.slice(0, 8)
    : allItems.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.description?.toLowerCase().includes(query.toLowerCase()) ||
        item.keywords?.toLowerCase().includes(query.toLowerCase())
      );

  // Group by category
  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const flatItems = Object.values(grouped).flat();

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected(prev => Math.min(prev + 1, flatItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected(prev => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        flatItems[selected]?.action();
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, flatItems, selected, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selected}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="cmd-palette relative w-full max-w-xl animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0); }}
            placeholder="Search pages, workflows, actions..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none font-medium"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-bold text-slate-600 bg-slate-800/60 border border-slate-700 rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {Object.entries(grouped).length === 0 && (
            <div className="py-8 flex flex-col items-center gap-2 text-center">
              <Hash className="w-6 h-6 text-slate-600" />
              <p className="text-sm text-slate-500 font-medium">No results for <span className="text-white">"{query}"</span></p>
            </div>
          )}

          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <p className="px-4 py-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                {category}
              </p>
              {items.map((item) => {
                const globalIdx = flatItems.indexOf(item);
                const Icon = item.icon;
                const isSelected = globalIdx === selected;

                return (
                  <button
                    key={item.id}
                    data-index={globalIdx}
                    onClick={item.action}
                    onMouseEnter={() => setSelected(globalIdx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isSelected ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isSelected ? "bg-primary/20" : "bg-white/[0.05]"
                    }`}>
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-primary" : "text-slate-400"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-[13px] font-semibold block ${isSelected ? "text-white" : "text-slate-200"}`}>
                        {item.label}
                      </span>
                      {item.description && (
                        <span className="text-[11px] text-slate-500">{item.description}</span>
                      )}
                    </div>
                    {isSelected && <ArrowRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-white/[0.05] flex items-center gap-4 text-[10px] text-slate-600 font-semibold">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> select</span>
          <span><kbd className="font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
