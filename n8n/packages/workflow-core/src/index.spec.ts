import { GraphValidator } from "./graph-validator";
import { TopologicalSort } from "./topological-sort";
import { ExecutionEngine, NodeExecutionContext, NodeExecutionResult } from "./execution-engine";
import { WorkflowGraph } from "@n8n-clone/shared-types";

describe("Workflow Core tests", () => {
  describe("GraphValidator", () => {
    it("should validate a simple correct DAG", () => {
      const graph: WorkflowGraph = {
        version: "1.0",
        nodes: [
          { id: "node_1", type: "manual.trigger", name: "Manual", position: { x: 0, y: 0 }, config: {} },
          { id: "node_2", type: "http.request", name: "Fetch", position: { x: 100, y: 100 }, config: {} },
        ],
        edges: [
          { id: "edge_1", source: "node_1", target: "node_2" },
        ],
      };

      const result = GraphValidator.validate(graph);
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("should reject a graph without trigger", () => {
      const graph: WorkflowGraph = {
        version: "1.0",
        nodes: [
          { id: "node_2", type: "http.request", name: "Fetch", position: { x: 100, y: 100 }, config: {} },
        ],
        edges: [],
      };

      const result = GraphValidator.validate(graph);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Workflow must contain at least one trigger node (e.g. manual.trigger, cron.trigger, webhook.trigger).");
    });

    it("should reject a graph with cycles", () => {
      const graph: WorkflowGraph = {
        version: "1.0",
        nodes: [
          { id: "node_1", type: "manual.trigger", name: "Manual", position: { x: 0, y: 0 }, config: {} },
          { id: "node_2", type: "http.request", name: "Fetch", position: { x: 100, y: 100 }, config: {} },
          { id: "node_3", type: "delay", name: "Delay", position: { x: 200, y: 200 }, config: {} },
        ],
        edges: [
          { id: "edge_1", source: "node_1", target: "node_2" },
          { id: "edge_2", source: "node_2", target: "node_3" },
          { id: "edge_3", source: "node_3", target: "node_2" }, // Cycle here!
        ],
      };

      const result = GraphValidator.validate(graph);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((err) => err.includes("Cycle detected"))).toBe(true);
    });
  });

  describe("TopologicalSort", () => {
    it("should sort nodes in correct dependency order", () => {
      const graph: WorkflowGraph = {
        version: "1.0",
        nodes: [
          { id: "node_3", type: "delay", name: "Delay", position: { x: 200, y: 200 }, config: {} },
          { id: "node_2", type: "http.request", name: "Fetch", position: { x: 100, y: 100 }, config: {} },
          { id: "node_1", type: "manual.trigger", name: "Manual", position: { x: 0, y: 0 }, config: {} },
        ],
        edges: [
          { id: "edge_1", source: "node_1", target: "node_2" },
          { id: "edge_2", source: "node_2", target: "node_3" },
        ],
      };

      const sorted = TopologicalSort.sort(graph);
      expect(sorted.map((n) => n.id)).toEqual(["node_1", "node_2", "node_3"]);
    });
  });

  describe("ExecutionEngine", () => {
    it("should execute nodes sequentially and pass inputs", async () => {
      const graph: WorkflowGraph = {
        version: "1.0",
        nodes: [
          { id: "node_1", type: "manual.trigger", name: "Manual", position: { x: 0, y: 0 }, config: {} },
          { id: "node_2", type: "http.request", name: "Fetch", position: { x: 100, y: 100 }, config: {} },
        ],
        edges: [
          { id: "edge_1", source: "node_1", target: "node_2" },
        ],
      };

      const mockExecutors = {
        "manual.trigger": async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
          return { status: "success", output: { msg: "hello" } };
        },
        "http.request": async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
          const inputMsg = ctx.input?.node_1?.msg;
          return { status: "success", output: { received: inputMsg, fetched: true } };
        },
      };

      const engine = new ExecutionEngine();
      const results = await engine.executeWorkflow({
        workflowId: "wf-1",
        executionId: "exec-1",
        graph,
        triggerNodeId: "node_1",
        triggerPayload: { initial: true },
        credentials: {},
        executors: mockExecutors,
      });

      expect(results["node_1"]).toEqual({ msg: "hello" });
      expect(results["node_2"]).toEqual({ received: "hello", fetched: true });
    });

    it("should support branching for IF conditions", async () => {
      const graph: WorkflowGraph = {
        version: "1.0",
        nodes: [
          { id: "node_1", type: "manual.trigger", name: "Manual", position: { x: 0, y: 0 }, config: {} },
          { id: "node_2", type: "logic.if", name: "IfNode", position: { x: 100, y: 100 }, config: {} },
          { id: "node_3", type: "http.request", name: "TrueAction", position: { x: 200, y: 50 }, config: {} },
          { id: "node_4", type: "delay", name: "FalseAction", position: { x: 200, y: 200 }, config: {} },
        ],
        edges: [
          { id: "edge_1", source: "node_1", target: "node_2" },
          { id: "edge_2", source: "node_2", target: "node_3", sourceHandle: "true" },
          { id: "edge_3", source: "node_2", target: "node_4", sourceHandle: "false" },
        ],
      };

      const mockExecutors = {
        "manual.trigger": async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
          return { status: "success", output: { value: 10 } };
        },
        "logic.if": async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
          const val = ctx.input?.node_1?.value;
          const nextBranch = val > 5 ? "true" : "false";
          return { status: "success", output: { conditionPassed: true }, nextBranch };
        },
        "http.request": async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
          return { status: "success", output: { run: "true_path" } };
        },
        "delay": async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
          return { status: "success", output: { run: "false_path" } };
        },
      };

      const engine = new ExecutionEngine();
      const results = await engine.executeWorkflow({
        workflowId: "wf-1",
        executionId: "exec-2",
        graph,
        triggerNodeId: "node_1",
        triggerPayload: {},
        credentials: {},
        executors: mockExecutors,
      });

      expect(results["node_3"]).toEqual({ run: "true_path" });
      expect(results["node_4"]).toBeUndefined(); // Should be skipped!
    });

    it("should support nested inline sub-workflow execution using runSubWorkflow callback", async () => {
      const graph: WorkflowGraph = {
        version: "1.0",
        nodes: [
          { id: "node_1", type: "manual.trigger", name: "Manual", position: { x: 0, y: 0 }, config: {} },
          { id: "node_2", type: "ai.agent", name: "Agent", position: { x: 100, y: 100 }, config: {} },
        ],
        edges: [
          { id: "edge_1", source: "node_1", target: "node_2" },
        ],
      };

      const mockExecutors = {
        "manual.trigger": async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
          return { status: "success", output: { prompt: "run sub-flow" } };
        },
        "ai.agent": async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
          if (ctx.runSubWorkflow) {
            const subResult = await ctx.runSubWorkflow("wf-sub-1", { inputVal: 42 });
            return { status: "success", output: { subResult } };
          }
          return { status: "failed", error: "runSubWorkflow not provided" };
        },
      };

      const mockRunSubWorkflow = jest.fn().mockResolvedValue({ success: true, processed: 42 });

      const engine = new ExecutionEngine();
      const results = await engine.executeWorkflow({
        workflowId: "wf-main",
        executionId: "exec-main",
        graph,
        triggerNodeId: "node_1",
        triggerPayload: {},
        credentials: {},
        executors: mockExecutors,
        runSubWorkflow: mockRunSubWorkflow,
      });

      expect(mockRunSubWorkflow).toHaveBeenCalledWith("wf-sub-1", { inputVal: 42 });
      expect(results["node_2"]).toEqual({ subResult: { success: true, processed: 42 } });
    });
  });
});
