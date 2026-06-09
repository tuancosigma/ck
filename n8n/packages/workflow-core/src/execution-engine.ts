import { EventEmitter } from "events";
import { WorkflowGraph, WorkflowNode } from "@n8n-clone/shared-types";
import { TopologicalSort } from "./topological-sort";

export interface NodeExecutionContext {
  workflowId: string;
  executionId: string;
  nodeId: string;
  input: any;
  config: any;
  credentials: Record<string, any>;
  logger: {
    info: (msg: string) => void;
    error: (msg: string) => void;
  };
  signal?: AbortSignal;
  runSubWorkflow?: (workflowId: string, payload: any) => Promise<any>;
  fetchWorkflowsMetadata?: (ids: string[]) => Promise<Array<{ id: string; name: string; description?: string | null }>>;
}

export interface NodeExecutionResult {
  status: "success" | "failed" | "skipped";
  output?: any;
  error?: any;
  nextBranch?: string; // e.g. "true" or "false"
}

export interface WorkflowExecutionEvents {
  started: (data: { executionId: string; workflowId: string }) => void;
  node_started: (data: { executionId: string; nodeId: string; nodeName: string; nodeType: string; input: any }) => void;
  node_completed: (data: { executionId: string; nodeId: string; nodeName: string; nodeType: string; input: any; output: any; durationMs: number }) => void;
  node_failed: (data: { executionId: string; nodeId: string; nodeName: string; nodeType: string; input: any; error: any; durationMs: number }) => void;
  completed: (data: { executionId: string; workflowId: string; outputs: Record<string, any> }) => void;
  failed: (data: { executionId: string; workflowId: string; error: string }) => void;
}

export class ExecutionEngine extends EventEmitter {
  private executedNodes = new Map<string, any>();
  private nodeStatuses = new Map<string, "SUCCESS" | "FAILED" | "SKIPPED" >();
  private pendingInputs = new Map<string, Record<string, any>>(); // targetNodeId -> { [sourceNodeId]: output }

  constructor() {
    super();
  }

  // Helper type-safe emit
  public emitEvent<K extends keyof WorkflowExecutionEvents>(
    event: K,
    ...args: Parameters<WorkflowExecutionEvents[K]>
  ): boolean {
    return this.emit(event, ...args);
  }

  /**
   * Executes a workflow DAG.
   */
  public async executeWorkflow(params: {
    workflowId: string;
    executionId: string;
    graph: WorkflowGraph;
    triggerNodeId: string;
    triggerPayload: any;
    credentials: Record<string, Record<string, any>>; // credentialId -> decryptedData
    executors: Record<string, (ctx: NodeExecutionContext) => Promise<NodeExecutionResult>>;
    signal?: AbortSignal;
    runSubWorkflow?: (workflowId: string, payload: any) => Promise<any>;
    fetchWorkflowsMetadata?: (ids: string[]) => Promise<Array<{ id: string; name: string; description?: string | null }>>;
  }): Promise<Record<string, any>> {
    const { workflowId, executionId, graph, triggerNodeId, triggerPayload, credentials, executors, signal, runSubWorkflow, fetchWorkflowsMetadata } = params;

    this.emitEvent("started", { executionId, workflowId });

    // Validate graph contains trigger and targets exist
    const { nodes, edges } = graph;
    const nodeMap = new Map<string, WorkflowNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
      this.pendingInputs.set(node.id, {});
    }

    if (!nodeMap.has(triggerNodeId)) {
      const err = `Trigger node "${triggerNodeId}" not found in workflow definition.`;
      this.emitEvent("failed", { executionId, workflowId, error: err });
      throw new Error(err);
    }

    // Set trigger input
    this.pendingInputs.set(triggerNodeId, { trigger: triggerPayload });

    // Sort nodes topologically
    let orderedNodes: WorkflowNode[];
    try {
      orderedNodes = TopologicalSort.sort(graph);
    } catch (e: any) {
      const err = `Topological sort failed: ${e.message}`;
      this.emitEvent("failed", { executionId, workflowId, error: err });
      throw new Error(err);
    }

    // Determine triggers and reachable nodes
    const activeNodes = new Set<string>();
    activeNodes.add(triggerNodeId);

    // Run each node in topological order
    for (const node of orderedNodes) {
      if (signal?.aborted) {
        const err = "Workflow execution cancelled.";
        this.emitEvent("failed", { executionId, workflowId, error: err });
        throw new Error(err);
      }

      // Check if this node is active / reached by a predecessor
      if (!activeNodes.has(node.id)) {
        this.nodeStatuses.set(node.id, "SKIPPED");
        continue;
      }

      // Prepare context input
      const nodeInputs = this.pendingInputs.get(node.id) || {};
      // If it's the trigger node, input is the direct trigger payload.
      // Otherwise, we pass the inputs received from predecessors.
      const inputData = node.id === triggerNodeId ? triggerPayload : nodeInputs;

      const executor = executors[node.type];
      if (!executor) {
        const err = `Executor for node type "${node.type}" not found.`;
        this.emitEvent("failed", { executionId, workflowId, error: err });
        throw new Error(err);
      }

      // Set up simple console-like logger
      const logger = {
        info: (msg: string) => console.log(`[EXECUTION][INFO][Node: ${node.name}]: ${msg}`),
        error: (msg: string) => console.error(`[EXECUTION][ERROR][Node: ${node.name}]: ${msg}`),
      };

      // Gather node credentials
      const nodeCreds: Record<string, any> = {};
      if (node.credentials) {
        for (const [credName, credId] of Object.entries(node.credentials)) {
          if (credentials[credId]) {
            nodeCreds[credName] = credentials[credId];
          }
        }
      }

      const executionContext: NodeExecutionContext = {
        workflowId,
        executionId,
        nodeId: node.id,
        input: inputData,
        config: node.config || {},
        credentials: nodeCreds,
        logger,
        signal,
        runSubWorkflow,
        fetchWorkflowsMetadata,
      };

      this.emitEvent("node_started", {
        executionId,
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        input: inputData,
      });

      const startTime = Date.now();
      let result: NodeExecutionResult;

      // Extract node settings (retry & timeout)
      const retries = Number(node.config?.retryCount) || 0;
      const retryDelayMs = Number(node.config?.retryDelayMs) || 1000;
      const timeoutMs = Number(node.config?.timeoutMs) || 0; // 0 = no timeout

      let attempt = 0;
      let lastError: any = null;

      while (attempt <= retries) {
        if (signal?.aborted) {
          result = { status: "failed", error: "Cancelled during retry" };
          break;
        }

        try {
          if (timeoutMs > 0) {
            // Execute with timeout race
            let timer: any;
            const timeoutPromise = new Promise<NodeExecutionResult>((_, reject) => {
              timer = setTimeout(() => reject(new Error(`Timeout of ${timeoutMs}ms exceeded`)), timeoutMs);
            });
            try {
              result = await Promise.race([
                executor(executionContext),
                timeoutPromise,
              ]);
            } finally {
              if (timer) {
                clearTimeout(timer);
              }
            }
          } else {
            result = await executor(executionContext);
          }

          if (result.status === "success") {
            break; // Success! exit retry loop
          } else {
            lastError = result.error;
          }
        } catch (e: any) {
          lastError = e.message || e;
        }

        attempt++;
        if (attempt <= retries) {
          logger.info(`Node failed, retrying attempt ${attempt}/${retries} in ${retryDelayMs}ms...`);
          await new Promise((res) => setTimeout(res, retryDelayMs));
        }
      }

      const durationMs = Date.now() - startTime;

      // If all attempts failed or hit exception
      if (!result! || result.status !== "success") {
        const errorDetail = lastError || "Unknown execution failure";
        this.nodeStatuses.set(node.id, "FAILED");
        this.emitEvent("node_failed", {
          executionId,
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          input: inputData,
          error: errorDetail,
          durationMs,
        });

        this.emitEvent("failed", {
          executionId,
          workflowId,
          error: `Node "${node.name}" failed: ${JSON.stringify(errorDetail)}`,
        });
        throw new Error(`Node "${node.name}" failed: ${errorDetail}`);
      }

      // Success
      this.nodeStatuses.set(node.id, "SUCCESS");
      const output = result.output ?? {};
      this.executedNodes.set(node.id, output);

      this.emitEvent("node_completed", {
        executionId,
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        input: inputData,
        output,
        durationMs,
      });

      // Propagate output along edges
      const outgoingEdges = edges.filter((edge) => edge.source === node.id);

      for (const edge of outgoingEdges) {
        // If branching node (like logic.if), only follow edges matching nextBranch
        if (result.nextBranch !== undefined && edge.sourceHandle && edge.sourceHandle !== result.nextBranch) {
          continue; // Skip this path!
        }

        activeNodes.add(edge.target);
        const targetInputs = this.pendingInputs.get(edge.target) || {};
        targetInputs[node.id] = output;
        this.pendingInputs.set(edge.target, targetInputs);
      }
    }

    // Convert map to plain object
    const finalOutputs: Record<string, any> = {};
    for (const [nodeId, output] of this.executedNodes.entries()) {
      finalOutputs[nodeId] = output;
    }

    this.emitEvent("completed", { executionId, workflowId, outputs: finalOutputs });
    return finalOutputs;
  }
}
