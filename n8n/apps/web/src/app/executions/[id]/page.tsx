"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { JsonInspector } from "@/components/ui/json-inspector";
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { api } from "@/utils/api";
import {
  ArrowLeft,
  Clock,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  Webhook,
  PlayCircle,
  Cpu,
  Code,
  Mail,
  Database,
  GitFork,
  Activity,
  ChevronDown,
} from "lucide-react";

// --- Visual Custom Node Component with Status Indicators ---
const TracerNodeComponent = ({ data }: any) => {
  const isTrigger = data.type?.endsWith(".trigger");
  const isIfNode = data.type === "logic.if";

  let Icon = HelpCircle;
  if (data.type === "manual.trigger") Icon = PlayCircle;
  else if (data.type === "cron.trigger") Icon = Calendar;
  else if (data.type === "webhook.trigger") Icon = Webhook;
  else if (data.type === "http.request") Icon = Cpu;
  else if (data.type === "code.javascript") Icon = Code;
  else if (data.type === "delay") Icon = Clock;
  else if (data.type === "email.smtp") Icon = Mail;
  else if (data.type === "db.postgres.query") Icon = Database;
  else if (data.type === "logic.if") Icon = GitFork;

  return (
    <div className={`relative p-4 rounded-xl border bg-card/95 min-w-[210px] flex items-center gap-3 transition-all ${
      data.status === "SUCCESS" ? "border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]" :
      data.status === "FAILED" ? "border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]" :
      data.status === "RUNNING" ? "border-orange-400/60 shadow-[0_0_15px_rgba(251,146,60,0.2)] animate-pulse" :
      "border-border opacity-70"
    }`}>
      {/* Target port */}
      {!isTrigger && (
        <Handle type="target" position={Position.Left} id="input" className="!w-2 !h-2" />
      )}

      {/* Dynamic Status Badges */}
      {data.status === "SUCCESS" && (
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
      )}

      <div className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${
        data.status === "SUCCESS" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
        data.status === "FAILED" ? "bg-red-500/10 border-red-500/20 text-red-400" :
        data.status === "RUNNING" ? "bg-orange-500/10 border-orange-500/20 text-orange-400" :
        "bg-muted border-border text-primary"
      }`}>
        <Icon className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate">{data.name}</div>
        <div className="text-[9px] text-slate-500 uppercase tracking-wider truncate">
          {data.type}
        </div>
      </div>

      {/* Source ports */}
      {isIfNode ? (
        <>
          <Handle type="source" position={Position.Right} id="true" style={{ top: "25%" }} className="!w-2 !h-2" />
          <Handle type="source" position={Position.Right} id="false" style={{ top: "75%" }} className="!w-2 !h-2" />
        </>
      ) : (
        <Handle type="source" position={Position.Right} id="output" className="!w-2 !h-2" />
      )}
    </div>
  );
};

const nodeTypes = {
  tracerNode: TracerNodeComponent,
};

export default function ExecutionTracer() {
  const { id: executionId } = useParams() as { id: string };
  const router = useRouter();

  const [execution, setExecution] = useState<any>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeData, setSelectedNodeData] = useState<any | null>(null);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExecutionLogs();
  }, []);

  // SSE: subscribe to live node status updates while execution is active
  useEffect(() => {
    if (!execution) return;
    if (!["QUEUED", "RUNNING"].includes(execution.status)) return;

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return;

    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const es = new EventSource(
      `${apiBase}/executions/${executionId}/stream?token=${encodeURIComponent(token)}`
    );

    es.addEventListener("step", (e: MessageEvent) => {
      const step = JSON.parse(e.data) as { nodeId: string; nodeName: string; nodeType: string; status: string; durationMs: number | null };
      // Update ReactFlow node status immediately
      setNodes((prev) =>
        prev.map((n) =>
          n.id === step.nodeId
            ? { ...n, data: { ...n.data, status: step.status } }
            : n
        )
      );
      // Sync timeline sidebar steps list
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
  }, [execution?.status, executionId]);

  const fetchExecutionLogs = async () => {
    try {
      const data = await api.executions.get(executionId);
      setExecution(data);

      const stepsMap = new Map<string, any>();
      for (const step of data.steps) {
        stepsMap.set(step.nodeId, step);
      }

      // Reconstruct graph based on active version definition
      const graph = data.workflow?.versions?.find((v: any) => v.version === data.version)?.graph || { nodes: [], edges: [] };

      const flowNodes = graph.nodes.map((n: any) => {
        const step = stepsMap.get(n.id);
        return {
          id: n.id,
          type: "tracerNode",
          position: n.position || { x: 100, y: 150 },
          data: {
            id: n.id,
            type: n.type,
            name: n.name,
            status: step ? step.status : (data.status === "FAILED" ? "SKIPPED" : "PENDING"),
            stepLogs: step || null,
          },
        };
      });

      const flowEdges = graph.edges.map((e: any) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Node[] }) => {
      if (selectedNodes.length > 0) {
        const node = selectedNodes[0];
        setSelectedNodeData(node.data);
      }
      // Keep execution logs panel open when clicking or dragging the canvas!
    },
    []
  );

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Top Header Controls */}
      <header className="h-16 border-b border-border bg-card/30 backdrop-blur-md flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/workflows/${execution?.workflowId}/editor`)}
            className="p-2 border border-border rounded-lg text-slate-400 hover:text-white hover:bg-muted transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <div>
            <h1 className="font-semibold text-white text-base leading-none">
              Execution Logs Tracker
            </h1>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest mt-1 block">
              ID: {executionId}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Trigger:</span>
            <span className="text-xs font-semibold text-white bg-muted px-2 py-1 rounded border border-border">
              {execution?.triggerType}
            </span>
          </div>

          <div className={`px-4 py-1.5 rounded-lg text-xs font-bold ${
            execution?.status === "SUCCESS" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
            execution?.status === "FAILED" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
            "bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse"
          }`}>
            {execution?.status}
          </div>
        </div>
      </header>

      {/* Tracer Canvas Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 h-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onSelectionChange={onSelectionChange}
            fitView
          >
            <Background color="#1e293b" gap={20} size={1} />
            <Controls />
          </ReactFlow>
        </div>

        {/* Right Sidebar: Execution Step Detailed Logs */}
        <aside className="w-96 border-l border-border bg-card/25 backdrop-blur-md p-6 overflow-y-auto z-10 flex flex-col">
          {selectedNodeData ? (
            <div className="space-y-6 flex-1 flex flex-col">
              <header className="border-b border-border pb-4 flex-shrink-0">
                <h3 className="font-semibold text-white">{selectedNodeData.name}</h3>
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest block mt-0.5">
                  Type: {selectedNodeData.type}
                </span>
              </header>

              {selectedNodeData.stepLogs ? (
                <div className="space-y-5 flex-1 overflow-y-auto pr-1">
                  <div className="flex justify-between items-center bg-muted/30 border border-border px-3 py-2 rounded-lg text-xs">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Clock className="w-4 h-4" />
                      <span>Duration</span>
                    </div>
                    <span className="font-bold text-white">{selectedNodeData.stepLogs.durationMs}ms</span>
                  </div>

                  <JsonInspector
                    data={selectedNodeData.stepLogs.input}
                    label="Request Payload (Input)"
                    maxHeight="160px"
                  />

                  <JsonInspector
                    data={selectedNodeData.stepLogs.output ?? {}}
                    label="Response Payload (Output)"
                    maxHeight="160px"
                  />

                  {selectedNodeData.stepLogs.error && (
                    <JsonInspector
                      data={selectedNodeData.stepLogs.error}
                      label="Error Stack Trace"
                      maxHeight="160px"
                    />
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
                  <Activity className="w-10 h-10 mb-3 text-slate-600 animate-pulse" />
                  <p className="text-sm font-semibold">Node was not executed</p>
                  <p className="text-xs text-slate-600 mt-1">This node was skipped because the execution graph took a different branch or failed beforehand.</p>
                </div>
              )}
              
              <button
                type="button"
                onClick={() => setSelectedNodeData(null)}
                className="bg-transparent border border-border hover:bg-muted text-slate-400 hover:text-white font-semibold rounded-lg py-2 text-xs transition-all w-full flex-shrink-0 mt-4"
              >
                Back to Timeline
              </button>
            </div>
          ) : (
            <div className="space-y-6 flex-1 flex flex-col">
              {/* Execution Metadata card */}
              <header className="border-b border-border pb-4 flex-shrink-0">
                <h3 className="font-bold text-white text-sm">Execution Metadata</h3>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 block">Audit Diagnostics</span>
              </header>

              <div className="space-y-3 bg-muted/20 border border-border p-4 rounded-2xl text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Trigger Mode</span>
                  <span className="font-bold text-white uppercase">{execution?.triggerType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Overall Uptime</span>
                  <span className="font-bold text-emerald-400">Stable</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Created At</span>
                  <span className="font-mono text-slate-300">
                    {execution ? new Date(execution.createdAt).toLocaleTimeString() : "Pending"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Active Version</span>
                  <span className="font-bold text-white">Version {execution?.version}</span>
                </div>
              </div>

              {/* Execution Timeline (Trace Stepper) */}
              <div className="flex-1 flex flex-col min-h-0 space-y-4">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Chronological Execution Timeline</h4>
                
                <div className="flex-1 overflow-y-auto pr-1 space-y-2 border-l border-border pl-4 relative ml-2">
                  {execution?.steps && execution.steps.length > 0 ? (
                    <motion.div
                      initial="hidden"
                      animate="visible"
                      variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
                      className="space-y-2"
                    >
                      {execution.steps.map((step: any) => {
                        const isExpanded = expandedStepId === step.id;
                        const isSuccess = step.status === "SUCCESS";
                        return (
                          <motion.div
                            key={step.id}
                            variants={{ hidden: { opacity: 0, x: 10 }, visible: { opacity: 1, x: 0 } }}
                            transition={{ duration: 0.25 }}
                            onClick={() => setExpandedStepId(prev => prev === step.id ? null : step.id)}
                            className={`relative group cursor-pointer rounded-xl border overflow-hidden transition-all
                              ${step.status === "SUCCESS"
                                ? "border-l-2 border-l-emerald-500 border-border/30"
                                : step.status === "RUNNING"
                                ? "border-l-2 border-l-orange-400 border-border/30"
                                : "border-l-2 border-l-red-500 border-border/30"}
                              glass-panel`}
                          >
                            {/* Timeline dot */}
                            <div className="absolute left-[-22px] top-3 z-10 w-3 h-3 rounded-full bg-background flex items-center justify-center">
                              <div className={`w-2 h-2 rounded-full ${
                                step.status === "SUCCESS"
                                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                                  : step.status === "RUNNING"
                                  ? "bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.5)] animate-pulse"
                                  : "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]"
                              }`} />
                            </div>

                            {/* Step header */}
                            <div className="flex items-center gap-2.5 px-3 py-2.5">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isSuccess ? "bg-emerald-500" : "bg-red-500"}`} />
                              <span className="text-xs font-bold text-white flex-1 truncate group-hover:text-primary transition-colors">
                                {step.nodeName}
                              </span>
                              <span className="text-[9px] font-mono text-slate-500 flex-shrink-0">{step.durationMs}ms</span>
                              <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                              </motion.div>
                            </div>

                            {/* Expandable detail */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.25 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-3 pb-3 space-y-2 border-t border-border/20 pt-2">
                                    <JsonInspector data={step.input} label="Input" maxHeight="140px" />
                                    <JsonInspector data={step.output ?? step.error ?? {}} label="Output" maxHeight="140px" />
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-6 text-slate-500 h-32">
                      <Activity className="w-8 h-8 mb-2 text-slate-600 animate-pulse" />
                      <p className="text-xs font-semibold">No steps completed yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
