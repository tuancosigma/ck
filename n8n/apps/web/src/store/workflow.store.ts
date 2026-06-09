import { create } from "zustand";
import { Connection, Edge, Node, addEdge, OnNodesChange, OnEdgesChange, applyNodeChanges, applyEdgeChanges } from "reactflow";

interface WorkflowState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;

  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  selectNode: (nodeId: string | null) => void;
  updateNodeConfig: (
    nodeId: string,
    config: Record<string, any>,
    name?: string,
    credentials?: Record<string, string>
  ) => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  addNode: (node) => set({ nodes: [...get().nodes, node] }),

  onNodesChange: (changes) =>
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    }),

  onEdgesChange: (changes) =>
    set({
      edges: applyEdgeChanges(changes, get().edges),
    }),

  onConnect: (connection) => {
    // Check if source and target handles are connected
    // To support True/False branching, React Flow connection passes sourceHandle (e.g. "true" or "false")
    const newEdge: Edge = {
      id: `edge_${Date.now()}`,
      source: connection.source!,
      target: connection.target!,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
    };
    set({
      edges: addEdge(newEdge, get().edges),
    });
  },

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  updateNodeConfig: (nodeId, config, name, credentials) =>
    set({
      nodes: get().nodes.map((node) => {
        if (node.id === nodeId) {
          const updatedConfig = { ...node.data.config, ...config };
          const data = { ...node.data, config: updatedConfig };
          if (name) data.name = name;
          if (credentials) {
            data.credentials = { ...node.data.credentials, ...credentials };
          }
          return {
            ...node,
            data,
          };
        }
        return node;
      }),
    }),
}));
