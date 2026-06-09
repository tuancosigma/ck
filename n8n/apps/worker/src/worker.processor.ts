import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import { PrismaService } from "./prisma/prisma.service";
import { EncryptionUtil } from "./utils/encryption.util";
import { ExecutionEngine } from "@n8n-clone/workflow-core";
import { NODE_EXECUTOR_REGISTRY } from "@n8n-clone/node-registry";
import { WorkflowGraph } from "@n8n-clone/shared-types";

/**
 * Recursively masks sensitive fields inside log records to prevent secret leak.
 */
function maskSecrets(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(maskSecrets);
  }

  const masked: Record<string, any> = {};
  const secretKeywords = ["password", "secret", "token", "key", "pass", "authorization", "auth", "apikey"];

  for (const [k, v] of Object.entries(obj)) {
    const isSecretKey = secretKeywords.some((keyword) => k.toLowerCase().includes(keyword));
    if (isSecretKey && typeof v === "string") {
      masked[k] = "****** [MASKED SECRET] ******";
    } else if (typeof v === "object") {
      masked[k] = maskSecrets(v);
    } else {
      masked[k] = v;
    }
  }
  return masked;
}

@Injectable()
export class WorkerProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerProcessor.name);
  private worker!: Worker;
  private redisConnection!: Redis;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    const redisHost = process.env.REDIS_HOST || "localhost";
    const redisPort = Number(process.env.REDIS_PORT) || 6379;

    this.redisConnection = new Redis({
      host: redisHost,
      port: redisPort,
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker(
      "workflow-execution",
      async (job: Job) => {
        await this.processExecutionJob(job);
      },
      {
        connection: this.redisConnection as any,
        concurrency: 5, // Run up to 5 executions in parallel per worker process
      }
    );

    this.worker.on("completed", (job) => {
      this.logger.log(`Queue Job Completed: ${job.id}`);
    });

    this.worker.on("failed", (job, err) => {
      this.logger.error(`Queue Job Failed: ${job?.id} - Error: ${err.message}`);
    });

    this.logger.log("BullMQ Worker Processor successfully initialized and polling Redis...");
  }

  private async processExecutionJob(job: Job) {
    const { workflowId, executionId, triggerNodeId, triggerType, triggerPayload } = job.data;
    this.logger.log(`Processing execution: "${executionId}" for workflow: "${workflowId}"`);

    // 1. Fetch Execution log slot
    let execution = null;
    if (executionId) {
      execution = await this.prisma.execution.findUnique({
        where: { id: executionId },
      });
    }

    // If it's a schedule trigger, we may need to create the execution record now!
    if (!execution) {
      const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
      if (!workflow) {
        throw new Error(`Workflow "${workflowId}" not found.`);
      }

      execution = await this.prisma.execution.create({
        data: {
          id: executionId || undefined,
          workflowId,
          version: workflow.activeVersion,
          status: "QUEUED",
          triggerType,
        },
      });
    }

    // Double check cancellation
    if (execution.status === "CANCELLED") {
      this.logger.log(`Execution "${executionId}" was cancelled before start.`);
      return;
    }

    // 2. Fetch immutable Graph Version
    const versionRecord = await this.prisma.workflowVersion.findUnique({
      where: {
        workflowId_version: {
          workflowId,
          version: execution.version,
        },
      },
    });

    if (!versionRecord) {
      throw new Error(`Workflow version "${execution.version}" definition not found.`);
    }

    const graph = versionRecord.graph as unknown as WorkflowGraph;

    // 3. Resolve workspace + decrypt node credentials.
    // workspaceId scopes credential access so a graph cannot reference another tenant's secrets.
    const workflowRecord = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    const workspaceId = workflowRecord?.workspaceId;
    const decryptedCredentials = await this.loadDecryptedCredentials(graph, workspaceId);

    // 4. Set up Abort Signal for cancellation
    const abortController = new AbortController();

    // Check cancellation interval (simple polling check before running engine)
    const cancelCheckInterval = setInterval(async () => {
      const currentStatus = await this.prisma.execution.findUnique({
        where: { id: execution.id },
        select: { status: true },
      });
      if (currentStatus?.status === "CANCELLED") {
        abortController.abort();
        clearInterval(cancelCheckInterval);
      }
    }, 1000);

    // 5. Instantiate execution engine and hook database log writers
    const engine = new ExecutionEngine();

    engine.on("started", async () => {
      this.logger.log(`Workflow run started: ${execution.id}`);
      await this.prisma.execution.update({
        where: { id: execution.id },
        data: { status: "RUNNING" },
      });
    });

    // G3 fix: Persist per-node RUNNING/SUCCESS/FAILED status so the tracer shows live progress.
    this.attachExecutionLogListeners(engine, execution.id);

    // Recursive sub-workflow execution for AI agent tool calls.
    // depth guards against cyclic/self-referencing workflows blowing the stack / OOM.
    const MAX_SUBWORKFLOW_DEPTH = 5;
    const runSubWorkflow = async (subWorkflowId: string, payload: any, depth = 1): Promise<any> => {
      if (depth > MAX_SUBWORKFLOW_DEPTH) {
        throw new Error(`Sub-workflow recursion exceeded depth ${MAX_SUBWORKFLOW_DEPTH} (possible cycle at "${subWorkflowId}").`);
      }
      this.logger.log(`Sub-workflow execution "${subWorkflowId}" (depth ${depth})`);

      // Scope lookup to the parent workspace — a tool call must not trigger another tenant's workflow.
      const workflow = workspaceId
        ? await this.prisma.workflow.findFirst({ where: { id: subWorkflowId, workspaceId } })
        : null;
      if (!workflow) {
        throw new Error(`Sub-workflow "${subWorkflowId}" not found in this workspace.`);
      }

      const versionRecord = await this.prisma.workflowVersion.findUnique({
        where: { workflowId_version: { workflowId: subWorkflowId, version: workflow.activeVersion } },
      });
      if (!versionRecord) {
        throw new Error(`Sub-workflow version "${workflow.activeVersion}" definition not found.`);
      }

      const subGraph = versionRecord.graph as unknown as WorkflowGraph;
      const subDecryptedCredentials = await this.loadDecryptedCredentials(subGraph, workspaceId);

      const subExecution = await this.prisma.execution.create({
        data: { workflowId: subWorkflowId, version: workflow.activeVersion, status: "RUNNING", triggerType: "subworkflow" },
      });

      const subEngine = new ExecutionEngine();
      this.attachExecutionLogListeners(subEngine, subExecution.id);

      const subTriggerNode = subGraph.nodes.find((n) => n.type?.endsWith(".trigger"));
      if (!subTriggerNode) {
        throw new Error(`Trigger node not found in sub-workflow "${subWorkflowId}"`);
      }

      try {
        const subOutputs = await subEngine.executeWorkflow({
          workflowId: subWorkflowId,
          executionId: subExecution.id,
          graph: subGraph,
          triggerNodeId: subTriggerNode.id,
          triggerPayload: payload,
          credentials: subDecryptedCredentials,
          executors: NODE_EXECUTOR_REGISTRY,
          signal: abortController.signal,
          runSubWorkflow: (id, p) => runSubWorkflow(id, p, depth + 1),
          fetchWorkflowsMetadata: async (ids: string[]) =>
            this.prisma.workflow.findMany({
              where: { id: { in: ids } },
              select: { id: true, name: true, description: true },
            }),
        });

        await this.prisma.execution.update({
          where: { id: subExecution.id },
          data: { status: "SUCCESS", finishedAt: new Date() },
        });
        return subOutputs;
      } catch (subErr: any) {
        await this.prisma.execution.update({
          where: { id: subExecution.id },
          data: { status: "FAILED", error: subErr.message || String(subErr), finishedAt: new Date() },
        });
        throw subErr;
      }
    };

    try {
      // 6. Launch Execution
      await engine.executeWorkflow({
        workflowId,
        executionId: execution.id,
        graph,
        triggerNodeId,
        triggerPayload,
        credentials: decryptedCredentials,
        executors: NODE_EXECUTOR_REGISTRY,
        signal: abortController.signal,
        runSubWorkflow,
        fetchWorkflowsMetadata: async (ids: string[]) =>
          this.prisma.workflow.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true, description: true },
          }),
      });

      // 7. Update status to success
      await this.prisma.execution.update({
        where: { id: execution.id },
        data: {
          status: "SUCCESS",
          finishedAt: new Date(),
        },
      });
    } catch (engineErr: any) {
      this.logger.error(`Workflow execution failed: ${engineErr.message}`);

      // Double check if was cancelled
      const currentExec = await this.prisma.execution.findUnique({
        where: { id: execution.id },
        select: { status: true },
      });

      if (currentExec?.status !== "CANCELLED") {
        await this.prisma.execution.update({
          where: { id: execution.id },
          data: {
            status: "FAILED",
            error: engineErr.message || String(engineErr),
            finishedAt: new Date(),
          },
        });
      }
    } finally {
      clearInterval(cancelCheckInterval);
    }
  }

  /**
   * Wires DB log-writers onto an execution engine so each node's RUNNING/SUCCESS/FAILED
   * status is persisted (upserted) as it runs. Shared by the main run and sub-workflow runs.
   */
  private attachExecutionLogListeners(engine: ExecutionEngine, executionId: string) {
    engine.on("node_started", async (data) => {
      const { nodeId, nodeName, nodeType } = data;
      await this.prisma.executionStep.upsert({
        where: { executionId_nodeId: { executionId, nodeId } },
        create: {
          executionId, nodeId, nodeName, nodeType,
          status: "RUNNING", input: maskSecrets(data.input || {}) as any, startedAt: new Date(),
        },
        update: { status: "RUNNING", startedAt: new Date() },
      });
    });

    engine.on("node_completed", async (data) => {
      const { nodeId, nodeName, nodeType, output, durationMs } = data;
      const maskedOutput = maskSecrets(output || {});
      await this.prisma.executionStep.upsert({
        where: { executionId_nodeId: { executionId, nodeId } },
        create: {
          executionId, nodeId, nodeName, nodeType, status: "SUCCESS",
          input: maskSecrets(data.input || {}) as any, output: maskedOutput as any, durationMs,
        },
        update: { status: "SUCCESS", output: maskedOutput as any, durationMs },
      });
    });

    engine.on("node_failed", async (data) => {
      const { nodeId, nodeName, nodeType, error, durationMs } = data;
      await this.prisma.executionStep.upsert({
        where: { executionId_nodeId: { executionId, nodeId } },
        create: {
          executionId, nodeId, nodeName, nodeType, status: "FAILED",
          input: maskSecrets(data.input || {}) as any, error: error as any, durationMs,
        },
        update: { status: "FAILED", error: error as any, durationMs },
      });
    });
  }

  /**
   * Gathers credential IDs referenced by a graph's nodes and returns their decrypted data,
   * scoped to a workspace so a graph can never reference another tenant's secrets.
   */
  private async loadDecryptedCredentials(
    graph: WorkflowGraph,
    workspaceId?: string,
  ): Promise<Record<string, Record<string, any>>> {
    const credIds = new Set<string>();
    for (const node of graph.nodes) {
      if (node.credentials) {
        for (const credId of Object.values(node.credentials)) {
          if (credId) credIds.add(credId);
        }
      }
    }

    const decrypted: Record<string, Record<string, any>> = {};
    if (credIds.size === 0 || !workspaceId) return decrypted;

    const credentials = await this.prisma.credential.findMany({
      where: { id: { in: Array.from(credIds) }, workspaceId },
    });
    for (const cred of credentials) {
      try {
        decrypted[cred.id] = EncryptionUtil.decrypt(cred.encryptedData, cred.iv, cred.tag);
      } catch (e: any) {
        this.logger.error(`Failed to decrypt credential "${cred.name}" (${cred.id}): ${e.message}`);
      }
    }
    return decrypted;
  }

  async onModuleDestroy() {
    await this.worker.close().catch(() => {});
    this.redisConnection.disconnect();
  }
}
