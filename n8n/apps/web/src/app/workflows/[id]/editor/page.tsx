"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
} from "reactflow";
import "reactflow/dist/style.css";
import { api } from "@/utils/api";
import { 
  Save,
  Play,
  Power,
  ArrowLeft,
  Cpu,
  Mail,
  Database,
  Clock,
  Code,
  GitFork,
  Webhook,
  Calendar,
  PlayCircle,
  HelpCircle,
  ShieldCheck,
  Terminal,
  Bot,
  Scissors,
  Binary,
  Layers,
  Copy,
} from "lucide-react";

// --- Custom Node Visual Component for React Flow Canvas ---
const CustomNodeComponent = ({ data }: any) => {
  const isTrigger = data.type?.endsWith(".trigger");
  const isIfNode = data.type === "logic.if";

  let Icon = HelpCircle;
  if (data.type === "manual.trigger") Icon = PlayCircle;
  else if (data.type === "cron.trigger") Icon = Calendar;
  else if (data.type === "webhook.trigger") Icon = Webhook;
  else if (data.type === "http.request") Icon = Cpu;
  else if (data.type === "code.javascript") Icon = Code;
  else if (data.type === "delay") Icon = Clock;
  else if (data.type === "email.smtp" || data.type === "email.imap") Icon = Mail;
  else if (data.type === "db.postgres.query") Icon = Database;
  else if (data.type === "execute.command") Icon = Terminal;
  else if (data.type === "ai.agent") Icon = Bot;
  else if (data.type === "ai.chunker") Icon = Scissors;
  else if (data.type === "ai.embeddings") Icon = Binary;
  else if (data.type === "db.vectorstore") Icon = Layers;
  else if (data.type === "logic.if") Icon = GitFork;

  return (
    <div className="relative p-4 rounded-xl border border-border bg-card/90 min-w-[200px] flex items-center gap-3">
      {/* Target port (input) - Triggers don't have inputs */}
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Left}
          id="input"
          className="!w-2.5 !h-2.5 !bg-primary"
        />
      )}

      <div className="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center text-primary flex-shrink-0">
        <Icon className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate">{data.name}</div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider truncate">
          {data.type}
        </div>
      </div>

      {/* Source ports (outputs) */}
      {isIfNode ? (
        <>
          {/* Top-Right True handle */}
          <div className="absolute right-[-10px] top-[25%] flex items-center">
            <span className="text-[9px] text-emerald-400 font-bold mr-1.5 select-none">TRUE</span>
            <Handle
              type="source"
              position={Position.Right}
              id="true"
              style={{ top: "25%" }}
              className="!w-2.5 !h-2.5 !bg-emerald-400"
            />
          </div>
          {/* Bottom-Right False handle */}
          <div className="absolute right-[-10px] top-[75%] flex items-center">
            <span className="text-[9px] text-red-400 font-bold mr-1.5 select-none">FALSE</span>
            <Handle
              type="source"
              position={Position.Right}
              id="false"
              style={{ top: "75%" }}
              className="!w-2.5 !h-2.5 !bg-red-400"
            />
          </div>
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          className="!w-2.5 !h-2.5 !bg-primary"
        />
      )}
    </div>
  );
};

const nodeTypes = {
  customNode: CustomNodeComponent,
};

export default function WorkflowEditor() {
  const { id: workflowId } = useParams() as { id: string };
  const router = useRouter();

  const [workflow, setWorkflow] = useState<any>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [credentials, setCredentials] = useState<any[]>([]);

  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [active, setActive] = useState(false);

  // Selected Node configuration forms
  const [nodeName, setNodeName] = useState("");
  const [nodeConfig, setNodeConfig] = useState<Record<string, any>>({});
  const [nodeCredentials, setNodeCredentials] = useState<Record<string, string>>({});
  const [availableWorkflows, setAvailableWorkflows] = useState<any[]>([]);

  useEffect(() => {
    fetchWorkflowDetails();
    fetchCredentials();
    fetchAvailableWorkflows();
  }, []);

  const fetchAvailableWorkflows = async () => {
    try {
      const list = await api.workflows.list();
      setAvailableWorkflows(list);
    } catch (e) {}
  };

  const fetchWorkflowDetails = async () => {
    try {
      const data = await api.workflows.get(workflowId);
      setWorkflow(data);
      setActive(data.status === "ACTIVE");

      // Load nodes & edges into React Flow canvas
      const graph = data.graph || { nodes: [], edges: [] };
      const flowNodes = graph.nodes.map((n: any) => ({
        id: n.id,
        type: "customNode",
        position: n.position || { x: 100, y: 150 },
        data: { id: n.id, type: n.type, name: n.name, config: n.config || {}, credentials: n.credentials || {} },
      }));

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
      router.push("/workflows");
    }
  };

  const fetchCredentials = async () => {
    try {
      const list = await api.credentials.list();
      setCredentials(list);
    } catch (e) {}
  };

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        id: `edge_${Date.now()}`,
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Node[] }) => {
      if (selectedNodes.length > 0) {
        const node = selectedNodes[0];
        setSelectedNode(node);
        setNodeName(node.data.name);
        setNodeConfig(node.data.config || {});
        setNodeCredentials(node.data.credentials || {});
      }
      // Keep the sidebar open even if the user clicks/drags the canvas! 
      // It will only close when they explicitly click the "Close" button.
    },
    []
  );

  // Sync selected node's input states in real-time back to React Flow's state
  useEffect(() => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === selectedNode.id) {
          return {
            ...n,
            data: {
              ...n.data,
              name: nodeName,
              config: nodeConfig,
              credentials: nodeCredentials,
            },
          };
        }
        return n;
      })
    );
  }, [nodeName, nodeConfig, nodeCredentials, selectedNode?.id, setNodes]);

  const handleUpdateNodeParams = () => {
    // Already synced in real-time. Close the sidebar panel.
    setSelectedNode(null);
  };

  const addPaletteNode = (type: string) => {
    const id = `${type.replace(".", "_")}_${Date.now()}`;
    const name = type.split(".").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
    
    const newNode: Node = {
      id,
      type: "customNode",
      position: { x: 300, y: 200 },
      data: { id, type, name, config: {}, credentials: {} },
    };

    setNodes((nds) => [...nds, newNode]);
  };

  // Helper to extract clean graph representation from React Flow canvas state
  const getGraphData = () => {
    const graphNodes = nodes.map((n) => ({
      id: n.id,
      type: n.data.type,
      name: n.data.name,
      position: n.position,
      config: n.data.config || {},
      credentials: n.data.credentials || {},
    }));

    const graphEdges = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || undefined,
      targetHandle: e.targetHandle || undefined,
    }));

    return { version: "1.0", nodes: graphNodes, edges: graphEdges };
  };

  const handleSaveWorkflow = async () => {
    setSaving(true);
    try {
      const graph = getGraphData();
      await api.workflows.update(workflowId, { graph });
      await fetchWorkflowDetails();
      alert("Workflow successfully saved and validated!");
    } catch (e: any) {
      alert(`Save Failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    try {
      if (active) {
        await api.workflows.deactivate(workflowId);
        setActive(false);
      } else {
        await api.workflows.activate(workflowId);
        setActive(true);
      }
      fetchWorkflowDetails();
    } catch (e: any) {
      alert(`Status toggle failed: ${e.message}`);
    }
  };

  const handleManualRun = async () => {
    setRunning(true);
    try {
      // Auto-save the latest visual layout and params to the DB before running!
      const graph = getGraphData();
      await api.workflows.update(workflowId, { graph });

      const exec = await api.workflows.run(workflowId);
      // Wait briefly for job to start, then route to the executions tracer page
      setTimeout(() => {
        router.push(`/executions/${exec.id}`);
      }, 800);
    } catch (e: any) {
      alert(`Manual execute failed: ${e.message}`);
      setRunning(false);
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden select-none">
      {/* Top Header Panel */}
      <header className="h-16 border-b border-border bg-card/30 backdrop-blur-md flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/workflows")}
            className="p-2 border border-border rounded-lg text-slate-400 hover:text-white hover:bg-muted transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <div>
            <h1 className="font-semibold text-white text-base leading-none">
              {workflow?.name || "Loading workflow..."}
            </h1>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest mt-1 block">
              Active Version: v{workflow?.activeVersion}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveWorkflow}
            disabled={saving}
            className="bg-muted hover:bg-accent border border-border text-white font-medium rounded-lg px-4 py-2 text-xs flex items-center gap-2 transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "Saving..." : "Save Graph"}</span>
          </button>

          <button
            onClick={handleManualRun}
            disabled={running}
            className="bg-primary hover:bg-primary/90 text-white font-medium rounded-lg px-4 py-2 text-xs flex items-center gap-2 transition-all shadow-lg shadow-primary/10"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{running ? "Enqueuing..." : "Manual Run"}</span>
          </button>

          <button
            onClick={handleToggleActive}
            className={`px-4 py-2 border rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              active
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                : "bg-slate-500/10 border-slate-500/20 text-slate-400 hover:bg-slate-500/20"
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{active ? "Active" : "Inactive"}</span>
          </button>
        </div>
      </header>

      {/* Webhook URL banner — visible when workflow is ACTIVE and has webhook trigger nodes */}
      {workflow?.status === "ACTIVE" && workflow?.webhookEndpoints?.length > 0 && (
        <div className="border-b border-border bg-emerald-950/30 px-6 py-2.5 flex items-center gap-3 text-sm z-10">
          <Webhook className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-slate-300 font-medium text-xs">Webhook URL:</span>
          <code className="text-emerald-300 font-mono text-xs bg-emerald-500/10 px-2 py-0.5 rounded truncate max-w-md">
            {workflow.webhookEndpoints[0].url}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(workflow.webhookEndpoints[0].url);
              // Auto-clear clipboard after 60s for security
              setTimeout(() => navigator.clipboard.writeText(""), 60000);
            }}
            className="p-1.5 rounded hover:bg-white/10 transition-colors flex-shrink-0"
            title="Copy webhook URL"
          >
            <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
          </button>
          {workflow.webhookEndpoints[0].syncMode && (
            <span className="text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0">
              Sync Mode
            </span>
          )}
        </div>
      )}

      {/* Editor Body */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Left Sidebar: Node Palette */}
        <aside className="w-64 border-r border-border bg-card/20 backdrop-blur-sm p-4 overflow-y-auto z-10 flex flex-col gap-6">
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Trigger Nodes</h3>
            <div className="space-y-2">
              {[
                { type: "manual.trigger", name: "Manual Trigger", Icon: PlayCircle },
                { type: "cron.trigger", name: "Cron trigger", Icon: Calendar },
                { type: "webhook.trigger", name: "Webhook trigger", Icon: Webhook },
              ].map((item) => (
                <button
                  key={item.type}
                  onClick={() => addPaletteNode(item.type)}
                  className="w-full flex items-center gap-3 px-3 py-2 border border-border rounded-lg bg-card/40 text-slate-300 text-xs font-semibold hover:border-primary hover:text-white transition-all text-left"
                >
                  <item.Icon className="w-4 h-4 text-primary" />
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Action Nodes</h3>
            <div className="space-y-2">
              {[
                { type: "http.request", name: "HTTP Request", Icon: Cpu },
                { type: "logic.if", name: "IF Branching", Icon: GitFork },
                { type: "code.javascript", name: "Javascript Sandbox", Icon: Code },
                { type: "delay", name: "Delay wait", Icon: Clock },
                { type: "email.smtp", name: "Send SMTP Email", Icon: Mail },
                { type: "email.imap", name: "Read IMAP Email", Icon: Mail },
                { type: "db.postgres.query", name: "PostgreSQL Query", Icon: Database },
                { type: "execute.command", name: "Execute Command", Icon: Terminal },
              ].map((item) => (
                <button
                  key={item.type}
                  onClick={() => addPaletteNode(item.type)}
                  className="w-full flex items-center gap-3 px-3 py-2 border border-border rounded-lg bg-card/40 text-slate-300 text-xs font-semibold hover:border-primary hover:text-white transition-all text-left"
                >
                  <item.Icon className="w-4 h-4 text-primary" />
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* AI Nodes section */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">AI & RAG Nodes</h3>
            <div className="space-y-2">
              <button
                onClick={() => addPaletteNode("ai.agent")}
                className="w-full flex items-center gap-3 px-3 py-2.5 border border-primary/40 rounded-lg bg-primary/5 text-slate-300 text-xs font-semibold hover:border-primary hover:bg-primary/10 hover:text-white transition-all text-left"
              >
                <Bot className="w-4 h-4 text-primary flex-shrink-0" />
                <div>
                  <span className="block">AI Agent</span>
                  <span className="text-[9px] text-primary/70 font-normal">OpenAI · Anthropic · Gemini</span>
                </div>
              </button>

              <button
                onClick={() => addPaletteNode("ai.chunker")}
                className="w-full flex items-center gap-3 px-3 py-2.5 border border-primary/40 rounded-lg bg-primary/5 text-slate-300 text-xs font-semibold hover:border-primary hover:bg-primary/10 hover:text-white transition-all text-left"
              >
                <Scissors className="w-4 h-4 text-primary flex-shrink-0" />
                <div>
                  <span className="block">AI Chunker</span>
                  <span className="text-[9px] text-primary/70 font-normal">Text Splitter & split strategies</span>
                </div>
              </button>

              <button
                onClick={() => addPaletteNode("ai.embeddings")}
                className="w-full flex items-center gap-3 px-3 py-2.5 border border-primary/40 rounded-lg bg-primary/5 text-slate-300 text-xs font-semibold hover:border-primary hover:bg-primary/10 hover:text-white transition-all text-left"
              >
                <Binary className="w-4 h-4 text-primary flex-shrink-0" />
                <div>
                  <span className="block">AI Embeddings</span>
                  <span className="text-[9px] text-primary/70 font-normal">OpenAI · Gemini Vector Gen</span>
                </div>
              </button>

              <button
                onClick={() => addPaletteNode("db.vectorstore")}
                className="w-full flex items-center gap-3 px-3 py-2.5 border border-primary/40 rounded-lg bg-primary/5 text-slate-300 text-xs font-semibold hover:border-primary hover:bg-primary/10 hover:text-white transition-all text-left"
              >
                <Layers className="w-4 h-4 text-primary flex-shrink-0" />
                <div>
                  <span className="block">PGVector Store</span>
                  <span className="text-[9px] text-primary/70 font-normal">Cosine distance search & upserts</span>
                </div>
              </button>
            </div>
          </div>
        </aside>

        {/* Center: React Flow Canvas */}
        <div className="flex-1 h-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onSelectionChange={onSelectionChange}
            fitView
          >
            <Background color="#1e293b" gap={20} size={1} />
            <Controls />
          </ReactFlow>
        </div>

        {/* Right Sidebar: Selected Node Config Parameter Editor */}
        {selectedNode && (
          <aside className="w-80 border-l border-border bg-card/25 backdrop-blur-md p-6 overflow-y-auto z-10 flex flex-col justify-between">
            <div className="space-y-6">
              <header className="border-b border-border pb-4">
                <h3 className="font-semibold text-white">Configure Node</h3>
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">{selectedNode.data.type}</span>
              </header>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">Display Name</label>
                  <input
                    type="text"
                    value={nodeName}
                    onChange={(e) => setNodeName(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* --- Dynamic fields per Node type --- */}
                {selectedNode.data.type === "cron.trigger" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Cron Expression</label>
                      <input
                        type="text"
                        value={nodeConfig.cron || ""}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, cron: e.target.value })}
                        placeholder="*/5 * * * *"
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Timezone</label>
                      <input
                        type="text"
                        value={nodeConfig.timezone || ""}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, timezone: e.target.value })}
                        placeholder="Asia/Ho_Chi_Minh"
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {selectedNode.data.type === "http.request" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">URL (resolves public IPs)</label>
                      <input
                        type="text"
                        value={nodeConfig.url || ""}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, url: e.target.value })}
                        placeholder="https://api.github.com/users"
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Method</label>
                      <select
                        value={nodeConfig.method || "GET"}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, method: e.target.value })}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none"
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">JSON Payload (Body)</label>
                      <textarea
                        value={typeof nodeConfig.body === "object" ? JSON.stringify(nodeConfig.body) : nodeConfig.body || ""}
                        onChange={(e) => {
                          try {
                            setNodeConfig({ ...nodeConfig, body: JSON.parse(e.target.value) });
                          } catch (err) {
                            setNodeConfig({ ...nodeConfig, body: e.target.value });
                          }
                        }}
                        placeholder='{"key": "value"}'
                        rows={3}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none resize-none font-mono"
                      />
                    </div>
                  </div>
                )}

                {selectedNode.data.type === "logic.if" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Value 1 (e.g. expression)</label>
                      <input
                        type="text"
                        value={nodeConfig.value1 || ""}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, value1: e.target.value })}
                        placeholder="{{ node_1.statusCode }}"
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Operator</label>
                      <select
                        value={nodeConfig.operator || "equal"}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, operator: e.target.value })}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none"
                      >
                        <option value="equal">Equals</option>
                        <option value="not_equal">Not Equals</option>
                        <option value="contains">Contains</option>
                        <option value="greater_than">Greater Than</option>
                        <option value="less_than">Less Than</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Value 2</label>
                      <input
                        type="text"
                        value={nodeConfig.value2 || ""}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, value2: e.target.value })}
                        placeholder="200"
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {selectedNode.data.type === "code.javascript" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Javascript Code</label>
                    <textarea
                      value={nodeConfig.code || ""}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, code: e.target.value })}
                      placeholder="return { title: $json.rows[0].title };"
                      rows={8}
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none font-mono resize-none leading-normal"
                    />
                  </div>
                )}

                {selectedNode.data.type === "delay" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Delay Duration (Seconds)</label>
                    <input
                      type="number"
                      value={nodeConfig.seconds || ""}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, seconds: Number(e.target.value) })}
                      placeholder="5"
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>
                )}

                {selectedNode.data.type === "email.smtp" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Mapped Credentials</label>
                      <select
                        value={nodeCredentials.smtp || ""}
                        onChange={(e) => setNodeCredentials({ ...nodeCredentials, smtp: e.target.value })}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none"
                      >
                        <option value="">Select Credentials...</option>
                        {credentials
                          .filter((c) => c.type === "smtp")
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Send to Email</label>
                      <input
                        type="email"
                        value={nodeConfig.to || ""}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, to: e.target.value })}
                        placeholder="recipient@domain.com"
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Subject</label>
                      <input
                        type="text"
                        value={nodeConfig.subject || ""}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, subject: e.target.value })}
                        placeholder="Dynamic Subject {{ $json.someKey }}"
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">HTML Body</label>
                      <textarea
                        value={nodeConfig.html || ""}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, html: e.target.value })}
                        placeholder="HTML email template..."
                        rows={3}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none resize-none"
                      />
                    </div>
                  </div>
                )}

                {selectedNode.data.type === "email.imap" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Mapped SMTP/IMAP Credentials</label>
                      <select
                        value={nodeCredentials.smtp || ""}
                        onChange={(e) => setNodeCredentials({ ...nodeCredentials, smtp: e.target.value })}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none"
                      >
                        <option value="">Select Credentials...</option>
                        {credentials
                          .filter((c) => c.type === "smtp")
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Mailbox Folder</label>
                      <input
                        type="text"
                        value={nodeConfig.mailbox || ""}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, mailbox: e.target.value })}
                        placeholder="INBOX"
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Fetch Limit</label>
                      <input
                        type="number"
                        value={nodeConfig.limit || ""}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, limit: Number(e.target.value) })}
                        placeholder="10"
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-400">Only Unread Emails</label>
                      <input
                        type="checkbox"
                        checked={nodeConfig.onlyUnread !== false}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, onlyUnread: e.target.checked })}
                        className="w-4 h-4 rounded border-border focus:ring-primary text-primary"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-400">Mark as Read (\Seen)</label>
                      <input
                        type="checkbox"
                        checked={nodeConfig.markAsSeen !== false}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, markAsSeen: e.target.checked })}
                        className="w-4 h-4 rounded border-border focus:ring-primary text-primary"
                      />
                    </div>
                  </div>
                )}

                {selectedNode.data.type === "db.postgres.query" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Mapped DB Credentials</label>
                      <select
                        value={nodeCredentials.postgres || ""}
                        onChange={(e) => setNodeCredentials({ ...nodeCredentials, postgres: e.target.value })}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none"
                      >
                        <option value="">Select Credentials...</option>
                        {credentials
                          .filter((c) => c.type === "postgres")
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">SQL Statement</label>
                      <textarea
                        value={nodeConfig.query || ""}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, query: e.target.value })}
                        placeholder="SELECT * FROM users WHERE active = true LIMIT 5;"
                        rows={5}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none font-mono resize-none leading-normal"
                      />
                    </div>
                  </div>
                )}

                {selectedNode.data.type === "execute.command" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">System Command</label>
                      <input
                        type="text"
                        value={nodeConfig.command || ""}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, command: e.target.value })}
                        placeholder="python app.py daily"
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Working Directory (CWD)</label>
                      <input
                        type="text"
                        value={nodeConfig.cwd || ""}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, cwd: e.target.value })}
                        placeholder="C:\Users\USER\Downloads\b_z4Z5YrBZ8eP-1773282434925"
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                )}

                {selectedNode.data.type === "ai.agent" && (
                  <div className="space-y-3">
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs text-slate-300">
                      <span className="text-primary font-bold flex items-center gap-1">
                        <Bot className="w-3.5 h-3.5" /> AI Agent Node
                      </span>
                      <p className="mt-1 text-slate-400 text-[10px] leading-relaxed">
                        Calls an LLM and returns the AI response. Use <code className="text-primary bg-primary/10 px-0.5 rounded">{`{{ $json.field }}`}</code> in prompts to reference previous node outputs.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">API Key Credential</label>
                      <select
                        value={nodeCredentials.apiKey || ""}
                        onChange={(e) => setNodeCredentials({ ...nodeCredentials, apiKey: e.target.value })}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none"
                      >
                        <option value="">Select API Key credential...</option>
                        {credentials
                          .filter((c) => c.type === "apiKey")
                          .map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                      </select>
                      {credentials.filter((c) => c.type === "apiKey").length === 0 && (
                        <p className="text-[10px] text-amber-400 mt-1">
                          ⚠️ No API key credentials found. Add one in the Credentials page first.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Provider</label>
                      <select
                        value={nodeConfig.provider || "openai"}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, provider: e.target.value })}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none"
                      >
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="gemini">Google Gemini</option>
                        <option value="groq">Groq</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Model</label>
                      <input
                        type="text"
                        value={nodeConfig.model || ""}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, model: e.target.value })}
                        placeholder={
                          nodeConfig.provider === "anthropic" ? "claude-3-5-sonnet-20241022" :
                          nodeConfig.provider === "gemini" ? "gemini-2.0-flash" :
                          nodeConfig.provider === "groq" ? "llama-3.3-70b-versatile" :
                          "gpt-4o-mini"
                        }
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">System Prompt</label>
                      <textarea
                        value={nodeConfig.systemPrompt || ""}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, systemPrompt: e.target.value })}
                        placeholder={"You are a helpful AI assistant.\nAnalyze: {{ $json.text }}"}
                        rows={4}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none resize-none leading-relaxed"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">User Message</label>
                      <textarea
                        value={nodeConfig.userMessage || ""}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, userMessage: e.target.value })}
                        placeholder={"{{ $json }}"}
                        rows={2}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none resize-none font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Temperature</label>
                        <input
                          type="number"
                          min="0" max="2" step="0.1"
                          value={nodeConfig.temperature ?? 0.7}
                          onChange={(e) => setNodeConfig({ ...nodeConfig, temperature: parseFloat(e.target.value) })}
                          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Max Tokens</label>
                        <input
                          type="number"
                          min="1" max="16384"
                          value={nodeConfig.maxTokens ?? 2048}
                          onChange={(e) => setNodeConfig({ ...nodeConfig, maxTokens: parseInt(e.target.value) })}
                          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={nodeConfig.jsonMode || false}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, jsonMode: e.target.checked })}
                        className="w-3.5 h-3.5 text-primary"
                      />
                      <span className="text-xs text-slate-400 font-semibold">Force JSON output</span>
                    </label>

                    <div className="border-t border-border pt-4 mt-2">
                      <label className="block text-xs font-bold text-slate-400 mb-1">
                        Agent Tools (Workflows)
                      </label>
                      <p className="text-[10px] text-slate-500 mb-2 leading-relaxed">
                        Expose other workflows as semantic tools that this AI Agent can invoke dynamically in its reasoning loop.
                      </p>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {availableWorkflows
                          .filter((w) => w.id !== workflowId)
                          .map((w) => {
                            const isChecked = Array.isArray(nodeConfig.tools) && nodeConfig.tools.includes(w.id);
                            return (
                              <label
                                key={w.id}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                                  isChecked
                                    ? "bg-primary/10 border-primary/40 text-white"
                                    : "bg-muted/50 border-border hover:border-slate-500 text-slate-400"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const currentTools = Array.isArray(nodeConfig.tools) ? [...nodeConfig.tools] : [];
                                    if (e.target.checked) {
                                      setNodeConfig({
                                        ...nodeConfig,
                                        tools: [...currentTools, w.id],
                                      });
                                    } else {
                                      setNodeConfig({
                                        ...nodeConfig,
                                        tools: currentTools.filter((id) => id !== w.id),
                                      });
                                    }
                                  }}
                                  className="w-3.5 h-3.5 text-primary border-border focus:ring-primary rounded bg-muted"
                                />
                                <div className="min-w-0">
                                  <span className="block truncate font-semibold">{w.name}</span>
                                  {w.description && (
                                    <span className="block text-[9px] text-slate-500 truncate mt-0.5">
                                      {w.description}
                                    </span>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        {availableWorkflows.filter((w) => w.id !== workflowId).length === 0 && (
                          <div className="text-[10px] text-slate-500 italic p-2 bg-muted/40 rounded-lg text-center border border-border/50">
                            No other workflows available to use as tools.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {selectedNode.data.type === "ai.chunker" && (
                  <div className="space-y-3 animate-fade-in">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Target Text</label>
                      <textarea
                        value={nodeConfig.text || ""}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, text: e.target.value })}
                        placeholder="{{ $json.text }}"
                        rows={3}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none resize-none font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Chunk Size</label>
                        <input
                          type="number"
                          min="10"
                          value={nodeConfig.chunkSize ?? 500}
                          onChange={(e) => setNodeConfig({ ...nodeConfig, chunkSize: parseInt(e.target.value) })}
                          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Chunk Overlap</label>
                        <input
                          type="number"
                          min="0"
                          value={nodeConfig.chunkOverlap ?? 50}
                          onChange={(e) => setNodeConfig({ ...nodeConfig, chunkOverlap: parseInt(e.target.value) })}
                          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Separator</label>
                      <input
                        type="text"
                        value={nodeConfig.separator || ""}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, separator: e.target.value })}
                        placeholder="\\n"
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                )}

                {selectedNode.data.type === "ai.embeddings" && (
                  <div className="space-y-3 animate-fade-in">
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs text-slate-300">
                      <span className="text-primary font-bold flex items-center gap-1">
                        <Binary className="w-3.5 h-3.5" /> AI Embeddings Node
                      </span>
                      <p className="mt-1 text-slate-400 text-[10px] leading-relaxed">
                        Generates a vector embedding for inputs using OpenAI or Google Gemini. Requires mapped API Key credential.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">API Key Credential</label>
                      <select
                        value={nodeCredentials.apiKey || ""}
                        onChange={(e) => setNodeCredentials({ ...nodeCredentials, apiKey: e.target.value })}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none"
                      >
                        <option value="">Select API Key credential...</option>
                        {credentials
                          .filter((c) => c.type === "apiKey")
                          .map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Provider</label>
                      <select
                        value={nodeConfig.provider || "openai"}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, provider: e.target.value })}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none"
                      >
                        <option value="openai">OpenAI</option>
                        <option value="gemini">Google Gemini</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Embedding Model</label>
                      <input
                        type="text"
                        value={nodeConfig.model || ""}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, model: e.target.value })}
                        placeholder={nodeConfig.provider === "gemini" ? "text-embedding-004" : "text-embedding-3-small"}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                )}

                {selectedNode.data.type === "db.vectorstore" && (
                  <div className="space-y-3 animate-fade-in">
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs text-slate-300">
                      <span className="text-primary font-bold flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" /> PGVector Store Node
                      </span>
                      <p className="mt-1 text-slate-400 text-[10px] leading-relaxed">
                        Performs semantic similarity query or registers document chunks inside PGVector table dynamically.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Postgres DB Credential</label>
                      <select
                        value={nodeCredentials.postgres || ""}
                        onChange={(e) => setNodeCredentials({ ...nodeCredentials, postgres: e.target.value })}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none"
                      >
                        <option value="">Select Postgres credential...</option>
                        {credentials
                          .filter((c) => c.type === "postgres")
                          .map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Action</label>
                      <select
                        value={nodeConfig.action || "upsert"}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, action: e.target.value })}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none"
                      >
                        <option value="upsert">Upsert (Store Embeddings)</option>
                        <option value="query">Query (Semantic Search)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Vector Table Name</label>
                      <input
                        type="text"
                        value={nodeConfig.tableName || ""}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, tableName: e.target.value })}
                        placeholder="vector_store_documents"
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none font-mono"
                      />
                    </div>
                    
                    {nodeConfig.action === "upsert" ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 mb-1">Chunks List Expression</label>
                          <input
                            type="text"
                            value={nodeConfig.chunks || ""}
                            onChange={(e) => setNodeConfig({ ...nodeConfig, chunks: e.target.value })}
                            placeholder="{{ $node['AI Chunker'].chunks }}"
                            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 mb-1">Embeddings List Expression</label>
                          <input
                            type="text"
                            value={nodeConfig.embeddings || ""}
                            onChange={(e) => setNodeConfig({ ...nodeConfig, embeddings: e.target.value })}
                            placeholder="{{ $node['AI Embeddings'].embeddings }}"
                            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none font-mono"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 mb-1">Query Embedding Vector</label>
                          <input
                            type="text"
                            value={nodeConfig.embeddings || ""}
                            onChange={(e) => setNodeConfig({ ...nodeConfig, embeddings: e.target.value })}
                            placeholder="{{ $node['AI Embeddings'].embedding }}"
                            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 mb-1">Similarity Matches Limit</label>
                          <input
                            type="number"
                            min="1" max="100"
                            value={nodeConfig.limit ?? 5}
                            onChange={(e) => setNodeConfig({ ...nodeConfig, limit: parseInt(e.target.value) })}
                            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Secure Parameter tags indicator */}
                <div className="bg-muted/30 border border-border rounded-lg px-3 py-2 text-[10px] text-slate-500 leading-normal flex gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span>Supports dynamic expressions like <code>{"{{ $json.field }}"}</code></span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-border mt-4">
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="flex-1 bg-transparent border border-border hover:bg-muted text-slate-400 hover:text-white font-semibold rounded-lg py-2 text-xs transition-all"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleUpdateNodeParams}
                className="flex-1 bg-primary hover:bg-primary/95 text-white font-semibold rounded-lg py-2 text-xs transition-all"
              >
                Apply Params
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
