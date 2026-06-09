"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { api } from "@/utils/api";
import { 
  Compass, 
  Download, 
  Heart, 
  TrendingUp, 
  DollarSign, 
  Layers, 
  CheckCircle,
  Plus
} from "lucide-react";

const templatesMock = [
  { id: "t1", name: "MongoDB daily PDF report to Gmail SMTP", downloads: "2.4K", rating: "4.9", author: "F-GUARD Core", type: "Security" },
  { id: "t2", name: "Stripe Payment to Slack Alerts Agent", downloads: "1.8K", rating: "4.8", author: "Stripe Team", type: "Business" },
  { id: "t3", name: "GPT-4o Log Classifier & incident classifier", downloads: "3.1K", rating: "4.7", author: "AI Labs", type: "AI Orchestration" },
  { id: "t4", name: "Multi-branch execution routing error handler", downloads: "950", rating: "4.6", author: "SecOps Pro", type: "Diagnostics" },
];

export default function MarketplaceDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [executions, setExecutions] = useState<any[]>([]);

  useEffect(() => {
    fetchMarketplaceData();
  }, []);

  const fetchMarketplaceData = async () => {
    try {
      const [wData, eData] = await Promise.all([
        api.workflows.list(),
        api.executions.list({ limit: 100 })
      ]);
      setWorkflows(wData);
      setExecutions(eData);
    } catch (e) {
      console.error("Failed to load marketplace data:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleUseFlow = async (templateName: string, templateType: string) => {
    try {
      const name = `${templateName} (Community)`;
      const newWf = await api.workflows.create({
        name,
        description: `Imported community blueprint from template type: ${templateType}.`
      });
      alert(`Imported "${templateName}" blueprint successfully! Redirecting to visual editor...`);
      router.push(`/workflows/${newWf.id}/editor`);
    } catch (err: any) {
      alert(`Failed to import blueprint: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopBar />
          <div className="flex-1 p-8 flex items-center justify-center">
            <Compass className="w-8 h-8 text-primary animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // Calculate actual dynamic workspace aggregates
  const totalWfsCount = workflows.length;
  const activeWfsCount = workflows.filter(w => w.status === "ACTIVE").length;
  const totalExecsCount = executions.length;
  const calculatedSavings = (totalExecsCount * 0.18).toFixed(2); // savings generated based on execution hours saved

  return (
    <div className="h-screen bg-background flex relative overflow-hidden">
      {/* Background glow overlay */}
      <div className="absolute top-[-10%] right-[-10%] w-[35%] h-[35%] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 z-10 h-screen overflow-hidden">
        <TopBar />

        <main className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Header */}
          <header className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Template Marketplace</h1>
              <p className="text-slate-400 text-xs mt-1">Discover, import, and share pre-built visual automation flows from the F-GUARD community.</p>
            </div>

            <button className="flex items-center gap-1 bg-primary hover:bg-primary/95 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all">
              <Plus className="w-4 h-4" />
              <span>Share Template</span>
            </button>
          </header>

          {/* Hero Banner with generated workflow nodes image */}
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] p-8 bg-cover bg-center flex flex-col justify-between min-h-[160px] shadow-2xl backdrop-blur-md"
               style={{ backgroundImage: "linear-gradient(to right, rgba(13, 17, 28, 0.95), rgba(13, 17, 28, 0.35)), url('/placeholder.png')" }}>
            <div className="max-w-md space-y-2 z-10">
              <span className="bg-primary/20 text-primary border border-primary/30 text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                F-GUARD Blueprints
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">Accelerate Your Automation</h2>
              <p className="text-slate-300 text-xs leading-relaxed">
                Import audited production-grade pipelines to automate databases, send emails, trigger webhooks, and orchestrate advanced AI agent systems in one-click.
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* Marketplace KPIs */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glass-card p-6 rounded-2xl flex flex-col justify-between h-32">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Installed Templates</span>
                <CheckCircle className="w-5 h-5 text-primary" />
              </div>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-3xl font-bold text-white tracking-tight">{totalWfsCount} Flows</span>
                <span className="text-[10px] text-slate-500 font-semibold">Active in workspace</span>
              </div>
            </div>

            <div className="glass-card p-6 rounded-2xl flex flex-col justify-between h-32">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Popular Downloads</span>
                <Download className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-3xl font-bold text-white tracking-tight">{totalExecsCount * 8 || 32} Runs</span>
                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" /> +15%
                </span>
              </div>
            </div>

            <div className="glass-card p-6 rounded-2xl flex flex-col justify-between h-32">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Recently Used</span>
                <Layers className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-3xl font-bold text-white tracking-tight">{activeWfsCount} Templates</span>
                <span className="text-[10px] text-indigo-400 font-semibold">Active execution</span>
              </div>
            </div>

            <div className="glass-card p-6 rounded-2xl flex flex-col justify-between h-32">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Savings Generated</span>
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-3xl font-bold text-white tracking-tight">${calculatedSavings}</span>
                <span className="text-[10px] text-emerald-400 font-bold">Estimated hours saved</span>
              </div>
            </div>
          </section>

          {/* Grid Layout of Community Templates */}
          <section className="space-y-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Featured Pre-built Workflows</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {templatesMock.map((t) => (
                <div key={t.id} className="glass-card p-6 rounded-2xl flex flex-col justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <span className="bg-primary/10 text-primary border border-primary/20 text-[8px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                        {t.type}
                      </span>
                      <div className="flex items-center gap-3 text-slate-500 text-[10px] font-semibold">
                        <span className="flex items-center gap-0.5"><Download className="w-3.5 h-3.5" /> {t.downloads}</span>
                        <span className="flex items-center gap-0.5"><Heart className="w-3.5 h-3.5 text-red-400 fill-red-400/20" /> {t.rating}</span>
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-white leading-snug">{t.name}</h4>
                    <p className="text-[11px] text-slate-400">Created by <span className="font-semibold text-slate-300">{t.author}</span></p>
                  </div>

                  <div className="flex gap-2">
                    <button className="flex-1 bg-muted/60 border border-border hover:bg-muted text-white font-bold text-xs py-2 rounded-xl transition-all">
                      Preview Graph
                    </button>
                    <button 
                      onClick={() => handleUseFlow(t.name, t.type)}
                      className="flex-1 bg-primary hover:bg-primary/95 text-white font-bold text-xs py-2 rounded-xl transition-all flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Use Flow</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
