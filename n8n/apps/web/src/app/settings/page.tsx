"use client";

import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { Settings, Save, Shield, Key, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, Users, Calendar } from "lucide-react";
import { api } from "@/utils/api";

export default function SettingsDashboard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<any>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [showMasterKey, setShowMasterKey] = useState(false);

  const fetchWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.workspace.get();
      setWorkspace(data);
      setWorkspaceName(data?.name || "");
    } catch (err: any) {
      setError(err.message || "Failed to load workspace");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim()) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      await api.workspace.update(workspaceName.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      fetchWorkspace();
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopBar />
          <div className="flex-1 p-8 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Settings className="w-10 h-10 text-primary animate-pulse" />
              <span className="text-slate-500 text-sm">Loading settings...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[35%] h-[35%] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 z-10">
        <TopBar />

        <main className="flex-1 overflow-y-auto p-8 space-y-8">
          <header>
            <h1 className="text-2xl font-bold text-white tracking-tight">Platform Settings</h1>
            <p className="text-slate-400 text-xs mt-1">
              Configure workspace settings, encryption policies, and platform integrations.
            </p>
          </header>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 text-sm text-red-300">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {saved && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3 text-sm text-emerald-300">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span>Settings saved successfully!</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Workspace info cards */}
            <div className="space-y-4">
              <div className="glass-card p-5 rounded-xl">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-3">Workspace Info</span>
                <div className="space-y-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                    <div>
                      <span className="text-slate-400 block">Workspace ID</span>
                      <span className="text-white font-mono text-[10px] break-all">{workspace?.id || "—"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <div>
                      <span className="text-slate-400 block">Members</span>
                      <span className="text-white font-semibold">{workspace?.memberCount || 1}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div>
                      <span className="text-slate-400 block">Workflows</span>
                      <span className="text-white font-semibold">{workspace?.workflowCount || 0}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div>
                      <span className="text-slate-400 block">Created</span>
                      <span className="text-white font-semibold">
                        {workspace?.createdAt ? new Date(workspace.createdAt).toLocaleDateString() : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-card p-5 rounded-xl">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-3">Your Role</span>
                <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border inline-block ${
                  workspace?.role === "OWNER"
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                }`}>
                  {workspace?.role || "MEMBER"}
                </span>
              </div>
            </div>

            {/* Main settings form */}
            <div className="lg:col-span-2">
              <form onSubmit={handleSave} className="glass-card p-8 rounded-2xl space-y-6">
                <header className="border-b border-border pb-4 flex items-center gap-2 mb-6">
                  <Shield className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-white text-sm">Security & Workspace Policies</h3>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Workspace Name — editable, writes to DB */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                      Workspace Name
                    </label>
                    <input
                      type="text"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder="My Workspace"
                      className="w-full bg-muted/40 focus:bg-muted border border-border rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary/50 transition-all font-semibold"
                    />
                    <span className="text-[10px] text-slate-500">This name appears in TopBar workspace switcher</span>
                  </div>

                  {/* Master Key — read-only display of env var status */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                      AES-256-GCM Encryption Key
                    </label>
                    <div className="relative">
                      <input
                        type={showMasterKey ? "text" : "password"}
                        disabled
                        value="Set via MASTER_KEY environment variable"
                        className="w-full bg-muted/20 border border-border/80 rounded-xl px-4 py-2.5 text-xs text-slate-500 select-none focus:outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowMasterKey(!showMasterKey)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                      >
                        {showMasterKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Change via <code className="text-primary bg-primary/10 px-1 rounded">MASTER_KEY</code> env var and restart the API server
                    </span>
                  </div>
                </div>

                {/* Environment info (read-only) */}
                <div className="space-y-4 pt-4 border-t border-border/40">
                  <h4 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-indigo-400" />
                    <span>Runtime Configuration</span>
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { label: "JWT Expiry", value: "7 days", hint: "Set via JWT_SECRET env var" },
                      { label: "Redis Queue", value: "workflow-execution", hint: "BullMQ queue name" },
                      { label: "Encryption", value: "AES-256-GCM", hint: "All credentials are encrypted" },
                      { label: "Database", value: "PostgreSQL via Prisma", hint: "Set via DATABASE_URL env var" },
                    ].map(({ label, value, hint }) => (
                      <div key={label} className="p-3 bg-muted/20 border border-border rounded-xl">
                        <span className="font-bold text-white text-[11px] block">{label}</span>
                        <span className="text-primary text-xs font-semibold block mt-0.5">{value}</span>
                        <span className="text-[10px] text-slate-500 block mt-1 leading-normal">{hint}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-6 border-t border-border/40">
                  <button
                    type="submit"
                    disabled={saving || workspaceName === workspace?.name}
                    className="flex items-center gap-1.5 bg-primary hover:bg-primary/95 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>{saving ? "Saving..." : "Save Changes"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
