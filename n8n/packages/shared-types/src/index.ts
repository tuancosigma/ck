import { z } from "zod";

// --- Node Position Schema ---
export const NodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export type NodePosition = z.infer<typeof NodePositionSchema>;

// --- Workflow Node Schema ---
export const WorkflowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  name: z.string().min(1),
  position: NodePositionSchema,
  config: z.record(z.any()).optional().default({}),
  credentials: z.record(z.string()).optional(), // mapping of credentialName -> credentialId
});

export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;

// --- Workflow Edge Schema ---
export const WorkflowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().optional(), // branch name like "true" or "false"
  targetHandle: z.string().optional(),
});

export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;

// --- Workflow Graph (definition) Schema ---
export const WorkflowGraphSchema = z.object({
  version: z.string().default("1.0"),
  nodes: z.array(WorkflowNodeSchema),
  edges: z.array(WorkflowEdgeSchema),
});

export type WorkflowGraph = z.infer<typeof WorkflowGraphSchema>;

// --- Authentication Schemas ---
export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().optional(),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type LoginInput = z.infer<typeof LoginSchema>;

// --- Credentials Schemas ---
export const CredentialCreateSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1), // e.g., "smtp", "postgres"
  data: z.record(z.any()),  // Key-value sensitive pairs
});

export type CredentialCreateInput = z.infer<typeof CredentialCreateSchema>;

// --- Enums & Run Types ---
export type ExecutionStatus = "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";
export type StepStatus = "SUCCESS" | "FAILED" | "SKIPPED";
