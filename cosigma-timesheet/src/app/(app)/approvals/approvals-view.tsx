"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X, Filter, Inbox, Eye, Loader2 } from "lucide-react";
import { PageContainer } from "@/components/ui/motion";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, Label } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { fmtDate, fmtHours, initials } from "@/lib/format";
import type { TeamMemberApprovals, ApprovalEntry } from "@/lib/data/approvals";

export function ApprovalsView({ teams }: { teams: TeamMemberApprovals[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<ApprovalEntry | null>(null);
  const [rejecting, setRejecting] = useState<string[] | null>(null);
  const [note, setNote] = useState("");

  const visible = teams.filter((t) =>
    t.name.toLowerCase().includes(filter.toLowerCase())
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function act(ids: string[], action: "APPROVE" | "REJECT", noteText?: string) {
    if (ids.length === 0) return;
    setBusy(true);
    await fetch("/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, action, note: noteText }),
    });
    setBusy(false);
    setSelected(new Set());
    setRejecting(null);
    setNote("");
    router.refresh();
  }

  const totalPending = teams.reduce((s, t) => s + t.entries.length, 0);

  return (
    <PageContainer className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Approvals</h1>
          <p className="text-sm text-slate-400">
            {totalPending} submitted entries awaiting review
          </p>
        </div>
        <div className="relative">
          <Filter size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter members…"
            className="!w-56 !pl-9"
          />
        </div>
      </header>

      {/* Batch action bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass sticky top-4 z-20 flex items-center justify-between rounded-2xl px-5 py-3"
          >
            <span className="text-sm text-slate-300">{selected.size} selected</span>
            <div className="flex gap-2">
              <Button variant="success" disabled={busy} onClick={() => act([...selected], "APPROVE")}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Approve
              </Button>
              <Button variant="danger" disabled={busy} onClick={() => setRejecting([...selected])}>
                <X size={16} /> Reject
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {visible.length === 0 ? (
        <GlassCard className="flex h-48 flex-col items-center justify-center gap-3 p-6 text-slate-400">
          <Inbox size={32} className="text-slate-600" />
          <p className="text-sm">No submitted timesheets to review.</p>
        </GlassCard>
      ) : (
        <div className="space-y-5">
          {visible.map((team) => (
            <GlassCard key={team.userId} className="p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white">
                  {initials(team.name)}
                </div>
                <div>
                  <p className="font-medium text-white">{team.name}</p>
                  <p className="text-xs text-slate-500">{team.email}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Badge tone="indigo">{fmtHours(team.totalHours)}</Badge>
                  <Badge tone="slate">{team.entries.length} entries</Badge>
                </div>
              </div>

              <div className="space-y-2">
                <AnimatePresence>
                  {team.entries.map((e) => (
                    <motion.div
                      key={e.id}
                      layout
                      exit={{ opacity: 0, x: -20 }}
                      className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-2.5 transition-colors hover:border-indigo-500/30"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(e.id)}
                        onChange={() => toggle(e.id)}
                        className="h-4 w-4 accent-indigo-500"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-white">{e.project}</p>
                        <p className="truncate text-xs text-slate-500">
                          {fmtDate(e.workDate)} · {e.customer} · {e.workMode}
                        </p>
                      </div>
                      <span className="text-sm text-slate-300">{fmtHours(e.hours)}</span>
                      <button onClick={() => setDetail(e)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/10 hover:text-white">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => act([e.id], "APPROVE")} disabled={busy} className="rounded-lg p-1.5 text-emerald-400 hover:bg-emerald-500/10">
                        <Check size={16} />
                      </button>
                      <button onClick={() => setRejecting([e.id])} className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/10">
                        <X size={16} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Entry Details">
        {detail && (
          <div className="space-y-3 text-sm">
            <Row label="Project" value={detail.project} />
            <Row label="Customer" value={detail.customer} />
            <Row label="Date" value={fmtDate(detail.workDate)} />
            <Row label="Hours" value={fmtHours(detail.hours)} />
            <Row label="Work Mode" value={detail.workMode} />
            <Row label="Task Type" value={detail.taskType.replace("_", " ")} />
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Description</p>
              <p className="rounded-lg bg-white/5 p-3 text-slate-300">
                {detail.description || "—"}
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject note modal */}
      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title="Reject Entries">
        <div className="space-y-4">
          <div>
            <Label>Feedback note</Label>
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why is this being rejected?"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="danger" disabled={busy} onClick={() => rejecting && act(rejecting, "REJECT", note)}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
              Confirm Reject
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-white/5 pb-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}
