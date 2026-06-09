"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { api } from "@/utils/api";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { MotionCard } from "@/components/ui/motion-card";
import {
  GitBranch,
  Plus,
  Power,
  ChevronRight,
  Loader2,
  Calendar,
  Trash2,
  Search,
} from "lucide-react";

export default function WorkflowsDashboard() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [newWorkflowDesc, setNewWorkflowDesc] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const data = await api.workflows.list();
      setWorkflows(data);
    } catch (err) {
      console.error("Failed to load workflows:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkflowName.trim()) return;

    setSubmitting(true);
    try {
      const res = await api.workflows.create({
        name: newWorkflowName,
        description: newWorkflowDesc,
      });
      router.push(`/workflows/${res.id}/editor`);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
      setShowCreateModal(false);
    }
  };

  const toggleActive = async (id: string, currentStatus: string) => {
    try {
      if (currentStatus === "ACTIVE") {
        await api.workflows.deactivate(id);
      } else {
        await api.workflows.activate(id);
      }
      fetchWorkflows();
    } catch (err) {
      console.error("Error toggling active state:", err);
      alert(err instanceof Error ? err.message : "Activation failed");
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this workflow? This cannot be undone.")) return;

    try {
      await api.workflows.delete(id);
      fetchWorkflows();
    } catch (err) {
      console.error("Failed to delete workflow:", err);
      alert("Error deleting workflow.");
    }
  };

  return (
    <div className="h-screen bg-background flex relative overflow-hidden">
      {/* Glow effects */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[100px] pointer-events-none" />

      <Sidebar />

      {/* Main Console Workspace */}
      <div className="flex-1 flex flex-col min-w-0 z-10 h-screen overflow-hidden">
        <TopBar />
        
        <main className="flex-1 flex flex-col overflow-y-auto p-8">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
            <p className="text-slate-400 text-sm">Design, monitor, and scale serverless integrations.</p>
          </div>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowCreateModal(true)}
            className="bg-primary hover:bg-primary/95 text-white font-medium rounded-lg px-4 py-2 text-sm flex items-center gap-2 transition-all shadow-lg shadow-primary/10"
          >
            <Plus className="w-4 h-4" />
            <span>New Workflow</span>
          </motion.button>
        </header>

        {/* Search bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search workflows..."
            className="w-full max-w-sm pl-9 pr-4 py-2 rounded-xl bg-white/[0.04] border border-border/50
                       text-sm text-slate-200 placeholder-slate-600 focus:outline-none
                       focus:ring-1 focus:ring-violet-500/40 transition-all"
          />
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : workflows.length === 0 ? (
          <div className="flex-1 border border-dashed border-border rounded-2xl flex flex-col items-center justify-center p-12 bg-card/5">
            <GitBranch className="w-12 h-12 text-slate-600 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No active workflows</h3>
            <p className="text-slate-400 text-sm text-center max-w-sm mb-6">
              Create your very first automated integration and trigger it manual, on schedulers, or using webhooks.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-primary hover:bg-primary/95 text-white font-medium rounded-lg px-4 py-2 text-sm transition-all"
            >
              Get Started
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workflows
              .filter(wf => wf.name.toLowerCase().includes(search.toLowerCase()))
              .map((wf, i) => (
              <MotionCard key={wf.id} delay={i * 0.05} className="glass-card rounded-xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <h3 className="font-semibold text-lg text-white hover:text-primary transition-colors cursor-pointer"
                        onClick={() => router.push(`/workflows/${wf.id}/editor`)}>
                      {wf.name}
                    </h3>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActive(wf.id, wf.status)}
                        className={`p-1.5 rounded-lg border transition-all ${
                          wf.status === "ACTIVE"
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                            : "bg-slate-500/10 border-slate-500/20 text-slate-400 hover:bg-slate-500/20"
                        }`}
                      >
                        <Power className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteWorkflow(wf.id)}
                        className="p-1.5 rounded-lg border border-border bg-card hover:bg-red-500/5 hover:border-red-500/20 text-slate-500 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-slate-400 text-sm line-clamp-2 mb-4">
                    {wf.description || "No description provided."}
                  </p>
                </div>

                <div className="border-t border-border pt-4 mt-4 flex justify-between items-center">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>v{wf.activeVersion}</span>
                  </div>

                  <button
                    onClick={() => router.push(`/workflows/${wf.id}/editor`)}
                    className="text-primary hover:text-primary-foreground hover:bg-primary/10 rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <span>Configure Editor</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </MotionCard>
            ))}
            {workflows.filter(wf => wf.name.toLowerCase().includes(search.toLowerCase())).length === 0 && workflows.length > 0 && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full text-center py-12 text-slate-600 text-sm">
                No workflows match &ldquo;{search}&rdquo;
              </motion.p>
            )}
          </div>
        )}

        {/* Modal: Create Workflow */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-md rounded-2xl p-8 animate-in fade-in zoom-in duration-200">
              <h2 className="text-xl font-bold mb-2">Create New Workflow</h2>
              <p className="text-slate-400 text-sm mb-6">Give your visual execution graph a clean name and description.</p>

              <form onSubmit={handleCreateWorkflow} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Workflow Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newWorkflowName}
                    onChange={(e) => setNewWorkflowName(e.target.value)}
                    placeholder="e.g. Sync Database Records"
                    className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Description
                  </label>
                  <textarea
                    value={newWorkflowDesc}
                    onChange={(e) => setNewWorkflowDesc(e.target.value)}
                    placeholder="Brief details about what triggers and actions this automated graph handles..."
                    rows={3}
                    className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-slate-600 resize-none"
                  />
                </div>

                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="bg-transparent border border-border hover:bg-muted text-foreground font-semibold rounded-lg px-4 py-2 text-sm transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-primary hover:bg-primary/95 text-white font-semibold rounded-lg px-4 py-2 text-sm transition-all disabled:opacity-50"
                  >
                    {submitting ? "Creating..." : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        </main>
      </div>
    </div>
  );
}
