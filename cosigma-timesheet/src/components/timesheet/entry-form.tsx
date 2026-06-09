"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Save, Send, Loader2, AlertCircle, Building2, Home, Blend, Zap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Label } from "@/components/ui/field";
import { Badge, statusTone } from "@/components/ui/badge";
import { ProjectAutocomplete, type ProjectOption } from "./project-autocomplete";
import { TaskTypeChips } from "./task-type-chips";
import { fmtDayShort } from "@/lib/format";
import type { TimesheetEntryDTO } from "@/lib/data/timesheet";

const MODES = ["WFH", "ONSITE", "HYBRID"];

// One-tap presets that populate hours + mode + split instantly.
const PRESETS = [
  { id: "onsite", label: "Full Onsite 8h", icon: Building2, mode: "ONSITE", hours: 8, onsite: 8, remote: 0 },
  { id: "wfh", label: "Full WFH 8h", icon: Home, mode: "WFH", hours: 8, onsite: 0, remote: 8 },
  { id: "hybrid", label: "Standard Hybrid", icon: Blend, mode: "HYBRID", hours: 8, onsite: 4, remote: 4 },
] as const;

export function EntryForm({
  selectedDate,
  existing,
  projects,
  defaultWorkMode,
  lastProjectId,
  onSaved,
}: {
  selectedDate: string;
  existing: TimesheetEntryDTO | null;
  projects: ProjectOption[];
  defaultWorkMode: string;
  lastProjectId: string | null;
  onSaved: () => void;
}) {
  // State seeds from props. The parent re-keys this component per selected day /
  // entry, so these initializers re-run on switch — no reset effect needed.
  const [projectId, setProjectId] = useState(
    existing?.projectId ?? lastProjectId ?? projects[0]?.projectId ?? ""
  );
  const [hours, setHours] = useState(existing?.hours ?? 8);
  const [workMode, setWorkMode] = useState(existing?.workMode ?? defaultWorkMode);
  const [onsiteHours, setOnsiteHours] = useState(
    existing?.onsiteHours ?? (defaultWorkMode === "ONSITE" ? 8 : 0)
  );
  const [remoteHours, setRemoteHours] = useState(
    existing?.remoteHours ?? (defaultWorkMode === "ONSITE" ? 0 : 8)
  );
  const [taskType, setTaskType] = useState(existing?.taskType ?? "DEVELOPMENT");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [isOvertime, setIsOvertime] = useState(existing?.isOvertime ?? false);
  const [isBillable, setIsBillable] = useState(existing?.isBillable ?? true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null);
  const [flash, setFlash] = useState(0); // bump to replay a quick-fill pulse
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFlash, setAiFlash] = useState(0); // bump to replay the AI slide-down

  // Expand brief notes into a polished worklog via the AI/local endpoint.
  async function generateWorklog() {
    if (!description.trim() || aiLoading) return;
    setAiLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/suggest-worklog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: description }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.text) {
        setDescription(data.text);
        setAiFlash((f) => f + 1);
      } else {
        setError(data.error ?? "Could not generate description.");
      }
    } catch {
      setError("Could not generate description.");
    }
    setAiLoading(false);
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setWorkMode(p.mode);
    setHours(p.hours);
    setOnsiteHours(p.onsite);
    setRemoteHours(p.remote);
    setError("");
    setFlash((f) => f + 1);
  }

  // Onsite/remote split: HYBRID is user-edited; WFH/ONSITE derive from total.
  function resolveSplit() {
    if (workMode === "WFH") return { onsiteHours: 0, remoteHours: hours };
    if (workMode === "ONSITE") return { onsiteHours: hours, remoteHours: 0 };
    return { onsiteHours, remoteHours };
  }

  const splitMismatch =
    workMode === "HYBRID" && Math.abs(onsiteHours + remoteHours - hours) > 0.01;

  async function save(status: "DRAFT" | "SUBMITTED") {
    setError("");
    if (!projectId) return setError("Please select a project.");
    if (splitMismatch)
      return setError("Onsite + remote hours must equal total hours.");

    setSaving(status === "DRAFT" ? "draft" : "submit");
    const split = resolveSplit();
    const res = await fetch("/api/timesheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: existing?.id,
        projectId,
        workDate: selectedDate,
        hours,
        workMode,
        onsiteHours: split.onsiteHours,
        remoteHours: split.remoteHours,
        taskType,
        description,
        isOvertime,
        isBillable,
        status,
      }),
    });
    setSaving(null);
    if (res.ok) {
      onSaved();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save entry.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white">{fmtDayShort(selectedDate)}</h3>
          <p className="text-xs text-slate-500">
            {existing ? "Editing entry" : "New entry"}
          </p>
        </div>
        {existing && <Badge tone={statusTone(existing.status)}>{existing.status}</Badge>}
      </div>

      {/* Quick-fill presets */}
      <div>
        <Label>Quick Fill</Label>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const Icon = p.icon;
            return (
              <motion.button
                key={p.id}
                type="button"
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => applyPreset(p)}
                className="flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1.5 text-xs font-medium text-indigo-200 transition-colors hover:border-indigo-400/60 hover:bg-indigo-500/20"
              >
                <Zap size={13} className="text-indigo-300" />
                <Icon size={13} />
                {p.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div>
        <Label>Project</Label>
        <ProjectAutocomplete
          projects={projects}
          value={projectId}
          onChange={setProjectId}
        />
      </div>

      <motion.div
        key={flash}
        initial={flash ? { backgroundColor: "rgba(99,102,241,0.12)" } : false}
        animate={{ backgroundColor: "rgba(99,102,241,0)" }}
        transition={{ duration: 0.6 }}
        className="grid grid-cols-2 gap-3 rounded-xl"
      >
        <div>
          <Label>Total Hours</Label>
          <Input
            type="number"
            min={0}
            max={24}
            step={0.5}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
          />
        </div>
        <div>
          <Label>Work Mode</Label>
          <Select value={workMode} onChange={(e) => setWorkMode(e.target.value)}>
            {MODES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
        </div>
      </motion.div>

      {/* HYBRID dynamic split — animated height reveal. */}
      <AnimatePresence initial={false}>
        {workMode === "HYBRID" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3">
              <div>
                <Label>Onsite Hours</Label>
                <Input
                  type="number" min={0} max={24} step={0.5}
                  value={onsiteHours}
                  onChange={(e) => setOnsiteHours(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Remote Hours</Label>
                <Input
                  type="number" min={0} max={24} step={0.5}
                  value={remoteHours}
                  onChange={(e) => setRemoteHours(Number(e.target.value))}
                />
              </div>
              {splitMismatch && (
                <p className="col-span-2 flex items-center gap-1.5 text-xs text-rose-400">
                  <AlertCircle size={13} />
                  Onsite + remote ({onsiteHours + remoteHours}h) must equal {hours}h.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <Label>Task Type</Label>
        <TaskTypeChips value={taskType} onChange={setTaskType} />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <Label className="mb-0">Description</Label>
          <motion.button
            type="button"
            onClick={generateWorklog}
            disabled={aiLoading || !description.trim()}
            whileTap={{ scale: 0.92 }}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-indigo-300 transition-colors hover:text-indigo-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles
              size={13}
              className={aiLoading ? "animate-spin text-violet-400" : ""}
            />
            {aiLoading ? "Polishing…" : "AI polish"}
          </motion.button>
        </div>
        <motion.div
          key={aiFlash}
          initial={aiFlash ? { opacity: 0, y: -8 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <Textarea
            rows={2}
            value={description}
            disabled={aiLoading}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What did you work on? e.g. fixed login, team meeting"
          />
        </motion.div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-slate-300">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isBillable} onChange={(e) => setIsBillable(e.target.checked)} className="accent-indigo-500" />
          Billable
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isOvertime} onChange={(e) => setIsOvertime(e.target.checked)} className="accent-rose-500" />
          Overtime
        </label>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          <AlertCircle size={15} /> {error}
        </p>
      )}

      <div className="flex gap-3 pt-1">
        <Button variant="ghost" onClick={() => save("DRAFT")} disabled={saving !== null} className="flex-1">
          {saving === "draft" ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save Draft
        </Button>
        <Button variant="primary" onClick={() => save("SUBMITTED")} disabled={saving !== null} className="flex-1">
          {saving === "submit" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Submit
        </Button>
      </div>
    </div>
  );
}
