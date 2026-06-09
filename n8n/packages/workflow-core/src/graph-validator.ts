import { WorkflowGraph } from "@n8n-clone/shared-types";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class GraphValidator {
  /**
   * Validates if a workflow graph is a correct DAG (Directed Acyclic Graph)
   * with necessary components and connections.
   */
  public static validate(graph: WorkflowGraph): ValidationResult {
    const errors: string[] = [];

    const { nodes, edges } = graph;

    // 1. Basic checks
    if (!nodes || nodes.length === 0) {
      errors.push("Workflow must contain at least one node.");
      return { isValid: false, errors };
    }

    // 2. Node Map creation & verification
    const nodeIds = new Set<string>();
    let hasTrigger = false;

    for (const node of nodes) {
      if (nodeIds.has(node.id)) {
        errors.push(`Duplicate node ID found: "${node.id}".`);
      }
      nodeIds.add(node.id);

      if (node.type.endsWith(".trigger")) {
        hasTrigger = true;
      }
    }

    if (!hasTrigger) {
      errors.push("Workflow must contain at least one trigger node (e.g. manual.trigger, cron.trigger, webhook.trigger).");
    }

    // 3. Edge checks (ensure source/target are valid nodes)
    const adjacencyList: Map<string, string[]> = new Map();
    for (const nodeId of nodeIds) {
      adjacencyList.set(nodeId, []);
    }

    for (const edge of edges) {
      if (!nodeIds.has(edge.source)) {
        errors.push(`Edge "${edge.id}" has invalid source node: "${edge.source}".`);
      }
      if (!nodeIds.has(edge.target)) {
        errors.push(`Edge "${edge.id}" has invalid target node: "${edge.target}".`);
      }

      if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
        adjacencyList.get(edge.source)!.push(edge.target);
      }
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    // 4. Cycle Detection using DFS and coloring
    // visited state: 0 = unvisited, 1 = visiting, 2 = visited
    const visited = new Map<string, number>();
    for (const nodeId of nodeIds) {
      visited.set(nodeId, 0);
    }

    let hasCycle = false;

    const dfs = (nodeId: string): boolean => {
      visited.set(nodeId, 1); // State: visiting

      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        const state = visited.get(neighbor);
        if (state === 1) {
          // Found a back edge = Cycle!
          errors.push(`Cycle detected involving path from "${nodeId}" to "${neighbor}".`);
          hasCycle = true;
          return true;
        } else if (state === 0) {
          if (dfs(neighbor)) return true;
        }
      }

      visited.set(nodeId, 2); // State: completed visiting
      return false;
    };

    for (const nodeId of nodeIds) {
      if (visited.get(nodeId) === 0) {
        if (dfs(nodeId)) break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
