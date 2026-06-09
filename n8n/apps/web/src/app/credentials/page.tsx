"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { api } from "@/utils/api";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { MotionCard } from "@/components/ui/motion-card";
import {
  Key, Plus, Trash2, Pencil, Loader2, ShieldCheck,
  Database, Mail, Bot, Lock, Search,
} from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  smtp:     "SMTP",
  postgres: "PostgreSQL",
  apiKey:   "API Key",
};

function TypeChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-bold border transition-all duration-150 ${
        active
          ? "bg-violet-500/20 border-violet-500/50 text-violet-300"
          : "bg-white/[0.04] border-border/40 text-slate-500 hover:text-slate-300"
      }`}
    >
      {label}
    </motion.button>
  );
}

export default function CredentialsDashboard() {
  const router = useRouter();
  const [credentials, setCredentials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState("smtp");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [pgHost, setPgHost] = useState("");
  const [pgPort, setPgPort] = useState("5432");
  const [pgDatabase, setPgDatabase] = useState("");
  const [pgUser, setPgUser] = useState("");
  const [pgPassword, setPgPassword] = useState("");
  const [pgSsl, setPgSsl] = useState(false);
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [apiKeyProvider, setApiKeyProvider] = useState("openai");

  useEffect(() => { fetchCredentials(); }, []);

  const fetchCredentials = async () => {
    setLoading(true);
    try {
      const data = await api.credentials.list();
      setCredentials(data);
    } catch (err) {
      console.error("Failed to load credentials:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditCredential = (cred: any) => {
    setEditingId(cred.id);
    setName(cred.name);
    setType(cred.type);
    // Never pre-fill sensitive data fields — plaintext must not appear in UI
    setSmtpHost(""); setSmtpUser(""); setSmtpPass("");
    setPgHost(""); setPgDatabase(""); setPgUser(""); setPgPassword("");
    setApiKeyValue("");
    setShowCreateModal(true);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setEditingId(null);
    setName(""); setType("smtp");
    setSmtpHost(""); setSmtpUser(""); setSmtpPass("");
    setPgHost(""); setPgDatabase(""); setPgUser(""); setPgPassword("");
    setApiKeyValue("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      // Build data payload — only include fields the user actually filled in
      let data: Record<string, any> = {};
      if (type === "smtp" && (smtpHost || smtpUser || smtpPass)) {
        data = { host: smtpHost, port: Number(smtpPort) || 587, user: smtpUser, pass: smtpPass, secure: smtpSecure };
      } else if (type === "apiKey" && apiKeyValue) {
        data = { key: apiKeyValue, provider: apiKeyProvider };
      } else if (type === "postgres" && (pgHost || pgDatabase || pgUser || pgPassword)) {
        data = { host: pgHost, port: Number(pgPort) || 5432, database: pgDatabase, user: pgUser, password: pgPassword, ssl: pgSsl };
      }

      if (editingId) {
        // Update mode — only send data if user provided new plaintext values
        await api.credentials.update(editingId, {
          name,
          type,
          ...(Object.keys(data).length > 0 ? { data } : {}),
        });
      } else {
        await api.credentials.create({ name, type, data });
      }

      handleCloseModal();
      fetchCredentials();
    } catch (err) {
      console.error("Failed to save credentials:", err);
      alert("Error saving credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this credential? Active workflows using it might fail.")) return;
    try {
      await api.credentials.delete(id);
      fetchCredentials();
    } catch (err) {
      console.error("Failed to delete credential:", err);
    }
  };

  const filtered = credentials.filter(c => {
    const matchName = c.name.toLowerCase().includes(search.toLowerCase());
    const matchType = !activeType || c.type === activeType;
    return matchName && matchType;
  });

  return (
    <div className="min-h-screen bg-background flex relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-500/5 blur-[100px] pointer-events-none" />

      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 z-10">
        <TopBar />

        <main className="flex-1 flex flex-col min-h-screen overflow-y-auto p-8">
          <header className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Credentials Vault</h1>
              <p className="text-slate-400 text-sm">Secure, encrypted connection vault for SMTP, Postgres, or API services.</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowCreateModal(true)}
              className="bg-primary hover:bg-primary/95 text-white font-medium rounded-lg px-4 py-2 text-sm flex items-center gap-2 transition-all shadow-lg shadow-primary/10"
            >
              <Plus className="w-4 h-4" />
              <span>Add Credentials</span>
            </motion.button>
          </header>

          {/* Search + filter chips */}
          <div className="mb-6 space-y-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search credentials..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/[0.04] border border-border/50 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/40 transition-all"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {([null, "smtp", "postgres", "apiKey"] as (string | null)[]).map(t => (
                <TypeChip
                  key={t ?? "all"}
                  label={t ? TYPE_LABELS[t] : "All"}
                  active={activeType === t}
                  onClick={() => setActiveType(prev => prev === t ? null : t)}
                />
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : credentials.length === 0 ? (
            <div className="flex-1 border border-dashed border-border rounded-2xl flex flex-col items-center justify-center p-12 bg-card/5">
              <Key className="w-12 h-12 text-slate-600 mb-4" />
              <h3 className="text-lg font-semibold mb-1">No credentials registered</h3>
              <p className="text-slate-400 text-sm text-center max-w-sm mb-6">
                Connect external systems securely. Plaintext data are encrypted at rest using AES-256-GCM and never returned to the UI client.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-primary hover:bg-primary/95 text-white font-medium rounded-lg px-4 py-2 text-sm transition-all"
              >
                Add Credentials
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((cred, i) => (
                <MotionCard key={cred.id} delay={i * 0.05} className="glass-card rounded-xl p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center text-primary">
                        {cred.type === "smtp" ? <Mail className="w-5 h-5" /> : cred.type === "apiKey" ? <Bot className="w-5 h-5" /> : <Database className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <h3 className="font-semibold text-white">{cred.name}</h3>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">{TYPE_LABELS[cred.type] ?? cred.type}</span>
                          <span className="text-[10px] font-bold text-emerald-500/70 tracking-wide uppercase">AES-256</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-muted/40 border border-border/60 rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-slate-400 mb-4">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Payload safely GCM-encrypted at rest</span>
                    </div>
                  </div>
                  <div className="border-t border-border pt-4 mt-2 flex items-center justify-between">
                    {/* AES-256-GCM encryption badge */}
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                        AES-256-GCM Encrypted
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditCredential(cred)}
                        className="text-slate-500 hover:text-violet-400 p-2 rounded-lg hover:bg-violet-500/5 transition-all"
                        title="Edit credential"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(cred.id)}
                        className="text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/5 transition-all"
                        title="Delete credential"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </MotionCard>
              ))}
              {filtered.length === 0 && credentials.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full text-center py-12 text-slate-600 text-sm">
                  No credentials match your search.
                </motion.div>
              )}
            </div>
          )}

          {showCreateModal && (
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="glass-card w-full max-w-lg rounded-2xl p-8 animate-in fade-in zoom-in duration-200 overflow-y-auto max-h-[90vh]">
                <h2 className="text-xl font-bold mb-2">{editingId ? "Update Credential" : "Register Secure Credentials"}</h2>
                <p className="text-slate-400 text-sm mb-6">
                  {editingId
                    ? "Update the name, type, or connection data. Leave data fields blank to keep existing encrypted values."
                    : "Select a type and input the required parameters securely."}
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Credential Name</label>
                    <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. My Production SMTP Server"
                      className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-slate-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">System Type</label>
                    <select value={type} onChange={e => setType(e.target.value)}
                      className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all">
                      <option value="smtp">SMTP (Email Server)</option>
                      <option value="postgres">PostgreSQL (Database)</option>
                      <option value="apiKey">API Key (OpenAI / Anthropic / Gemini)</option>
                    </select>
                  </div>

                  {editingId && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-xs text-amber-300 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                      <span>Leave data fields blank to keep existing encrypted values unchanged.</span>
                    </div>
                  )}

                  {type === "apiKey" ? (
                    <div className="space-y-4 pt-2 border-t border-border">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">AI Provider</label>
                        <select value={apiKeyProvider} onChange={e => setApiKeyProvider(e.target.value)}
                          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                          <option value="openai">OpenAI (GPT-4o, GPT-4, GPT-3.5-turbo)</option>
                          <option value="anthropic">Anthropic (Claude 3.5 Sonnet, Claude 3)</option>
                          <option value="gemini">Google Gemini (Gemini 2.0 Flash, Pro)</option>
                          <option value="custom">Custom (Other API provider)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">
                          API Key {editingId && <span className="text-amber-400 font-normal">(leave blank to keep existing)</span>}
                        </label>
                        <input type="password" value={apiKeyValue} onChange={e => setApiKeyValue(e.target.value)}
                          required={!editingId}
                          placeholder={editingId ? "Leave blank to keep existing" : (apiKeyProvider === "openai" ? "sk-proj-..." : apiKeyProvider === "anthropic" ? "sk-ant-..." : "Your API key")}
                          autoComplete="new-password"
                          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono" />
                      </div>
                    </div>
                  ) : type === "smtp" ? (
                    <div className="space-y-4 pt-2 border-t border-border">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Host</label>
                          <input type="text" required={!editingId} value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder={editingId ? "Leave blank to keep existing" : "smtp.mailgun.org"}
                            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Port</label>
                          <input type="number" value={smtpPort} onChange={e => setSmtpPort(e.target.value)} placeholder="587"
                            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">User</label>
                        <input type="text" required={!editingId} value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder={editingId ? "Leave blank to keep existing" : "postmaster@my-domain.com"}
                          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">
                          Password {editingId && <span className="text-amber-400 font-normal">(leave blank to keep existing)</span>}
                        </label>
                        <input type="password" required={!editingId} value={smtpPass} onChange={e => setSmtpPass(e.target.value)} placeholder={editingId ? "Leave blank to keep existing" : "••••••••••••••••"}
                          autoComplete="new-password"
                          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none" />
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="smtpSecure" checked={smtpSecure} onChange={e => setSmtpSecure(e.target.checked)}
                          className="w-4 h-4 accent-primary rounded bg-muted border-border" />
                        <label htmlFor="smtpSecure" className="text-sm text-slate-400 select-none">Requires SSL (Port 465)</label>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 pt-2 border-t border-border">
                      <div className="grid grid-cols-4 gap-4">
                        <div className="col-span-3">
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Host</label>
                          <input type="text" required={!editingId} value={pgHost} onChange={e => setPgHost(e.target.value)} placeholder={editingId ? "Leave blank to keep existing" : "pg-instance.rds.amazonaws.com"}
                            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Port</label>
                          <input type="number" value={pgPort} onChange={e => setPgPort(e.target.value)} placeholder="5432"
                            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Database Name</label>
                          <input type="text" required={!editingId} value={pgDatabase} onChange={e => setPgDatabase(e.target.value)} placeholder={editingId ? "Leave blank to keep existing" : "my_database"}
                            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Username</label>
                          <input type="text" required={!editingId} value={pgUser} onChange={e => setPgUser(e.target.value)} placeholder={editingId ? "Leave blank to keep existing" : "dbuser"}
                            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">
                          Password {editingId && <span className="text-amber-400 font-normal">(leave blank to keep existing)</span>}
                        </label>
                        <input type="password" required={!editingId} value={pgPassword} onChange={e => setPgPassword(e.target.value)} placeholder={editingId ? "Leave blank to keep existing" : "••••••••••••••••"}
                          autoComplete="new-password"
                          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none" />
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="pgSsl" checked={pgSsl} onChange={e => setPgSsl(e.target.checked)}
                          className="w-4 h-4 accent-primary rounded bg-muted border-border" />
                        <label htmlFor="pgSsl" className="text-sm text-slate-400 select-none">Requires SSL connection</label>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 justify-end pt-4 border-t border-border mt-6">
                    <button type="button" onClick={handleCloseModal}
                      className="bg-transparent border border-border hover:bg-muted text-foreground font-semibold rounded-lg px-4 py-2 text-sm transition-all">
                      Cancel
                    </button>
                    <button type="submit" disabled={submitting}
                      className="bg-primary hover:bg-primary/95 text-white font-semibold rounded-lg px-4 py-2 text-sm transition-all disabled:opacity-50">
                      {submitting ? (editingId ? "Updating..." : "Encrypting...") : (editingId ? "Update Credential" : "Save Securely")}
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
