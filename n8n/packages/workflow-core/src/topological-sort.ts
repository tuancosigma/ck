import { WorkflowGraph, WorkflowNode } from "@n8n-clone/shared-types";

export class TopologicalSort {
  /**
   * Sorts nodes of a validated DAG topologically.
   */
  public static sort(graph: WorkflowGraph): WorkflowNode[] {
    const { nodes, edges } = graph;

    // Create lookup map
    const nodeMap = new Map<string, WorkflowNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    // Build adjacency list
    const adjacencyList = new Map<string, string[]>();
    for (const node of nodes) {
      adjacencyList.set(node.id, []);
    }

    for (const edge of edges) {
      if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
        adjacencyList.get(edge.source)!.push(edge.target);
      }
    }

    const visited = new Set<string>();
    const stack: string[] = [];

    const dfs = (nodeId: string) => {
      visited.add(nodeId);

      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        }
      }

      stack.push(nodeId);
    };

    // Process all nodes (for forest of DAGs)
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    }

    // Reverse to get topological order
    const orderedIds = stack.reverse();

    // Map back to nodes
    return orderedIds
      .map((id) => nodeMap.get(id))
      .filter((n): n is WorkflowNode => !!n);
  }
}
