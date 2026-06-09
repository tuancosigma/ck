/**
 * Patch script: Replace polling with SSE in execution tracer page
 * and add RUNNING status visual.
 */
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "n8n/apps/web/src/app/executions/[id]/page.tsx");
let content = fs.readFileSync(filePath, "utf8");

// ── 1. Add Loader2 to imports if not already there (it's there already)
// ── 2. Update TracerNodeComponent to handle RUNNING status ──────────────────
const oldNodeBorderClass = `    <div className={\`relative p-4 rounded-xl border bg-card/95 min-w-[210px] flex items-center gap-3 transition-all \${
      data.status === "SUCCESS" ? "border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]" :
      data.status === "FAILED" ? "border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]" :
      "border-border opacity-70"
    }\`}>`;

const newNodeBorderClass = `    <div className={\`relative p-4 rounded-xl border bg-card/95 min-w-[210px] flex items-center gap-3 transition-all \${
      data.status === "SUCCESS" ? "border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]" :
      data.status === "FAILED" ? "border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]" :
      data.status === "RUNNING" ? "border-orange-400/60 shadow-[0_0_15px_rgba(251,146,60,0.2)] animate-pulse" :
      "border-border opacity-70"
    }\`}>`;

if (content.includes(oldNodeBorderClass)) {
  content = content.replace(oldNodeBorderClass, newNodeBorderClass);
  console.log("✓ Patch 1: RUNNING border added to TracerNodeComponent");
} else {
  console.error("✗ Patch 1 NOT applied — border class not found");
}

// ── 3. Add RUNNING badge inside TracerNodeComponent ─────────────────────────
const oldBadges = `      {data.status === "SUCCESS" && (
        <div className="absolute top-[-10px] right-[-10px] bg-background rounded-full p-0.5 z-20">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-500/10" />
        </div>
      )}
      {data.status === "FAILED" && (
        <div className="absolute top-[-10px] right-[-10px] bg-background rounded-full p-0.5 z-20">
          <XCircle className="w-5 h-5 text-red-500 fill-red-500/10" />
        </div>
      )}`;

const newBadges = `      {data.status === "SUCCESS" && (
        <div className="absolute top-[-10px] right-[-10px] bg-background rounded-full p-0.5 z-20">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-500/10" />
        </div>
      )}
      {data.status === "FAILED" && (
        <div className="absolute top-[-10px] right-[-10px] bg-background rounded-full p-0.5 z-20">
          <XCircle className="w-5 h-5 text-red-500 fill-red-500/10" />
        </div>
      )}
      {data.status === "RUNNING" && (
        <div className="absolute top-[-10px] right-[-10px] bg-background rounded-full p-0.5 z-20">
          <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
        </div>
      )}`;

if (content.includes(oldBadges)) {
  content = content.replace(oldBadges, newBadges);
  console.log("✓ Patch 2: RUNNING spinner badge added");
} else {
  console.error("✗ Patch 2 NOT applied — badge block not found");
}

// ── 4. Add RUNNING icon tint to the icon container ──────────────────────────
const oldIconContainer = `      <div className={\`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 \${
        data.status === "SUCCESS" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
        data.status === "FAILED" ? "bg-red-500/10 border-red-500/20 text-red-400" :
        "bg-muted border-border text-primary"
      }\`}>`;

const newIconContainer = `      <div className={\`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 \${
        data.status === "SUCCESS" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
        data.status === "FAILED" ? "bg-red-500/10 border-red-500/20 text-red-400" :
        data.status === "RUNNING" ? "bg-orange-500/10 border-orange-500/20 text-orange-400" :
        "bg-muted border-border text-primary"
      }\`}>`;

if (content.includes(oldIconContainer)) {
  content = content.replace(oldIconContainer, newIconContainer);
  console.log("✓ Patch 3: RUNNING icon tint added");
} else {
  console.error("✗ Patch 3 NOT applied — icon container not found");
}

// ── 5. Replace setInterval polling with SSE consumer ───────────────────────
const oldUseEffect = `  useEffect(() => {
    fetchExecutionLogs();

    // Auto refresh status every 2 seconds if execution is still queued or running!
    const interval = setInterval(async () => {
      if (execution && (execution.status === "QUEUED" || execution.status === "RUNNING")) {
        await fetchExecutionLogs();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [execution?.status]);`;

const newUseEffect = `  useEffect(() => {
    fetchExecutionLogs();
  }, []);

  // SSE: subscribe to live node status updates while execution is active
  useEffect(() => {
    if (!execution) return;
    if (!["QUEUED", "RUNNING"].includes(execution.status)) return;

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return;

    const es = new EventSource(
      \`http://localhost:3001/executions/\${executionId}/stream?token=\${encodeURIComponent(token)}\`
    );

    es.addEventListener("step", (e: MessageEvent) => {
      const step = JSON.parse(e.data) as { nodeId: string; nodeName: string; nodeType: string; status: string; durationMs: number | null };
      setNodes((prev) =>
        prev.map((n) =>
          n.id === step.nodeId
            ? { ...n, data: { ...n.data, status: step.status } }
            : n
        )
      );
      // Also update steps list in execution for the timeline sidebar
      setExecution((prev: any) => {
        if (!prev) return prev;
        const existing = prev.steps?.find((s: any) => s.nodeId === step.nodeId);
        const updatedStep = { ...(existing || {}), nodeId: step.nodeId, nodeName: step.nodeName, nodeType: step.nodeType, status: step.status, durationMs: step.durationMs };
        const filteredSteps = (prev.steps || []).filter((s: any) => s.nodeId !== step.nodeId);
        return { ...prev, steps: [...filteredSteps, updatedStep] };
      });
    });

    es.addEventListener("execution", (e: MessageEvent) => {
      const update = JSON.parse(e.data);
      setExecution((prev: any) => ({ ...prev, ...update }));
    });

    es.addEventListener("done", () => es.close());
    es.onerror = () => es.close();

    return () => es.close();
  }, [execution?.status, executionId]);`;

if (content.includes(oldUseEffect)) {
  content = content.replace(oldUseEffect, newUseEffect);
  console.log("✓ Patch 4: Polling replaced with SSE EventSource");
} else {
  console.error("✗ Patch 4 NOT applied — useEffect block not found");
}

// ── 6. Add RUNNING timeline dot style ────────────────────────────────────────
const oldTimelineDot = `                              <div className={\`w-2 h-2 rounded-full \${
                                isSuccess
                                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                                  : "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]"
                              }\`} />`;

const newTimelineDot = `                              <div className={\`w-2 h-2 rounded-full \${
                                step.status === "SUCCESS"
                                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                                  : step.status === "RUNNING"
                                  ? "bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.5)] animate-pulse"
                                  : "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]"
                              }\`} />`;

if (content.includes(oldTimelineDot)) {
  content = content.replace(oldTimelineDot, newTimelineDot);
  console.log("✓ Patch 5: RUNNING timeline dot added");
} else {
  console.error("✗ Patch 5 NOT applied — timeline dot not found");
}

// ── 7. Update RUNNING timeline step border ────────────────────────────────────
const oldStepBorder = `                              \${isSuccess
                                ? "border-l-2 border-l-emerald-500 border-border/30"
                                : "border-l-2 border-l-red-500 border-border/30"}`;

const newStepBorder = `                              \${step.status === "SUCCESS"
                                ? "border-l-2 border-l-emerald-500 border-border/30"
                                : step.status === "RUNNING"
                                ? "border-l-2 border-l-orange-400 border-border/30"
                                : "border-l-2 border-l-red-500 border-border/30"}`;

if (content.includes(oldStepBorder)) {
  content = content.replace(oldStepBorder, newStepBorder);
  console.log("✓ Patch 6: RUNNING step border added to timeline");
} else {
  console.error("✗ Patch 6 NOT applied — step border not found");
}

fs.writeFileSync(filePath, content, "utf8");
console.log("\n✅ All patches applied to execution tracer page");
