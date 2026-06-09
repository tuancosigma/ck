import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { QueueService } from "../queue/queue.service";
import { SchedulerService } from "../scheduler/scheduler.service";
import { GraphValidator } from "@n8n-clone/workflow-core";
import { WorkflowGraph, WorkflowGraphSchema } from "@n8n-clone/shared-types";
import * as crypto from "crypto";

@Injectable()
export class WorkflowsService {
  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
    private schedulerService: SchedulerService
  ) {}

  async create(workspaceId: string, name: string, description?: string) {
    const initialGraph: WorkflowGraph = {
      version: "1.0",
      nodes: [
        {
          id: "node_1",
          type: "manual.trigger",
          name: "Manual Trigger",
          position: { x: 100, y: 150 },
          config: {},
        },
      ],
      edges: [],
    };

    return this.prisma.$transaction(async (tx) => {
      const workflow = await tx.workflow.create({
        data: {
          workspaceId,
          name,
          description,
          status: "INACTIVE",
          activeVersion: 1,
        },
      });

      await tx.workflowVersion.create({
        data: {
          workflowId: workflow.id,
          version: 1,
          graph: initialGraph as any,
        },
      });

      return {
        ...workflow,
        graph: initialGraph,
      };
    });
  }

  async findAll(workspaceId: string) {
    return this.prisma.workflow.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
    });
  }

  async findOne(workspaceId: string, id: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, workspaceId },
    });

    if (!workflow) {
      throw new NotFoundException("Workflow not found.");
    }

    const [version, webhookEndpoints] = await Promise.all([
      this.prisma.workflowVersion.findUnique({
        where: { workflowId_version: { workflowId: id, version: workflow.activeVersion } },
      }),
      this.prisma.webhookEndpoint.findMany({
        where: { workflowId: id },
        select: { webhookPath: true, syncMode: true },
      }),
    ]);

    const apiBase = process.env.API_BASE_URL || "http://localhost:3001";

    return {
      ...workflow,
      graph: version?.graph as unknown as WorkflowGraph,
      webhookEndpoints: webhookEndpoints.map((e) => ({
        url: `${apiBase}/webhooks/${workspaceId}/${id}/${e.webhookPath}`,
        syncMode: e.syncMode,
      })),
    };
  }

  async update(workspaceId: string, id: string, name?: string, description?: string, graph?: WorkflowGraph) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, workspaceId },
    });

    if (!workflow) {
      throw new NotFoundException("Workflow not found.");
    }

    // Prepare update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    if (graph) {
      // Validate graph before saving!
      const parsed = WorkflowGraphSchema.safeParse(graph);
      if (!parsed.success) {
        throw new BadRequestException(`Invalid workflow structure: ${parsed.error.message}`);
      }

      const validation = GraphValidator.validate(graph);
      if (!validation.isValid) {
        throw new BadRequestException(`Workflow fails DAG checks: ${validation.errors.join(", ")}`);
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const nextVersionNum = workflow.activeVersion + 1;

        // Save immutable new version
        await tx.workflowVersion.create({
          data: {
            workflowId: id,
            version: nextVersionNum,
            graph: graph as any,
          },
        });

        // Update active version mapping in core workflow
        const updated = await tx.workflow.update({
          where: { id },
          data: {
            ...updateData,
            activeVersion: nextVersionNum,
          },
        });

        return {
          ...updated,
          graph,
        };
      });

      // G1 fix: Auto-reload cron + webhook triggers when ACTIVE workflow graph changes.
      // Mirrors the deactivate → activate cycle without changing the status field.
      if (workflow.status === "ACTIVE") {
        // 1. Remove old BullMQ repeatable jobs + DB schedule rows
        await this.schedulerService.deregisterSchedules(id);

        // 2. Re-register cron triggers from the new graph
        await this.schedulerService.registerSchedules(id, graph);

        // 3. Rotate webhook endpoints — old secret/path invalidated, fresh UUID assigned
        await this.prisma.$transaction(async (tx) => {
          await tx.webhookEndpoint.deleteMany({ where: { workflowId: id } });

          const webhookNodes = graph.nodes.filter((n) => n.type === "webhook.trigger");
          for (const node of webhookNodes) {
            const securePath = crypto.randomUUID();
            const secret = crypto.randomBytes(32).toString("hex");
            const syncMode = node.config?.responseMode === "sync";

            await tx.webhookEndpoint.create({
              data: { workflowId: id, webhookPath: securePath, secret, syncMode },
            });
          }
        });
      }

      // Return updated workflow with current webhook endpoints (rotated above if ACTIVE)
      return this.findOne(workspaceId, id);
    }

    const updated = await this.prisma.workflow.update({
      where: { id },
      data: updateData,
    });

    const activeVer = await this.prisma.workflowVersion.findUnique({
      where: {
        workflowId_version: {
          workflowId: id,
          version: updated.activeVersion,
        },
      },
    });

    return {
      ...updated,
      graph: activeVer?.graph as unknown as WorkflowGraph,
      webhookEndpoints: [],
    };
  }

  async remove(workspaceId: string, id: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, workspaceId },
    });

    if (!workflow) {
      throw new NotFoundException("Workflow not found.");
    }

    if (workflow.status === "ACTIVE") {
      await this.deactivate(workspaceId, id);
    }

    return this.prisma.workflow.delete({
      where: { id },
    });
  }

  async activate(workspaceId: string, id: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, workspaceId },
    });

    if (!workflow) {
      throw new NotFoundException("Workflow not found.");
    }

    if (workflow.status === "ACTIVE") {
      return this.findOne(workspaceId, id);
    }

    const version = await this.prisma.workflowVersion.findUnique({
      where: {
        workflowId_version: {
          workflowId: id,
          version: workflow.activeVersion,
        },
      },
    });

    const graph = version?.graph as unknown as WorkflowGraph;
    if (!graph) {
      throw new BadRequestException("Cannot activate workflow without node definitions.");
    }

    // Re-verify cycle checks on activation
    const validation = GraphValidator.validate(graph);
    if (!validation.isValid) {
      throw new BadRequestException(`Workflow fails activation checks: ${validation.errors.join(", ")}`);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Scan and register cron schedules
      await this.schedulerService.registerSchedules(id, graph);

      // 2. Scan and provision webhook endpoints
      const webhookNodes = graph.nodes.filter((n) => n.type === "webhook.trigger");
      for (const node of webhookNodes) {
        const securePath = crypto.randomUUID();
        const secret = crypto.randomBytes(32).toString("hex");
        const syncMode = node.config?.responseMode === "sync";

        await tx.webhookEndpoint.create({
          data: {
            workflowId: id,
            webhookPath: securePath,
            secret,
            syncMode,
          },
        });
      }

      const updated = await tx.workflow.update({
        where: { id },
        data: { status: "ACTIVE" },
      });

      return {
        ...updated,
        graph,
      };
    });
  }

  async deactivate(workspaceId: string, id: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, workspaceId },
    });

    if (!workflow) {
      throw new NotFoundException("Workflow not found.");
    }

    if (workflow.status === "INACTIVE") {
      return this.findOne(workspaceId, id);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Unregister active crons from BullMQ
      await this.schedulerService.deregisterSchedules(id);

      // 2. Remove webhook endpoint records
      await tx.webhookEndpoint.deleteMany({
        where: { workflowId: id },
      });

      const updated = await tx.workflow.update({
        where: { id },
        data: { status: "INACTIVE" },
      });

      const version = await tx.workflowVersion.findUnique({
        where: {
          workflowId_version: {
            workflowId: id,
            version: updated.activeVersion,
          },
        },
      });

      return {
        ...updated,
        graph: version?.graph as unknown as WorkflowGraph,
      };
    });
  }

  async run(workspaceId: string, id: string, payload?: any) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, workspaceId },
    });

    if (!workflow) {
      throw new NotFoundException("Workflow not found.");
    }

    const version = await this.prisma.workflowVersion.findUnique({
      where: {
        workflowId_version: {
          workflowId: id,
          version: workflow.activeVersion,
        },
      },
    });

    const graph = version?.graph as unknown as WorkflowGraph;
    if (!graph) {
      throw new BadRequestException("Workflow definition is empty.");
    }

    const manualNode = graph.nodes.find((n) => n.type === "manual.trigger");
    if (!manualNode) {
      throw new BadRequestException("This workflow does not contain a manual.trigger node and cannot be executed manually.");
    }

    // 1. Create DB log record
    const execution = await this.prisma.execution.create({
      data: {
        workflowId: id,
        version: workflow.activeVersion,
        status: "QUEUED",
        triggerType: "manual",
      },
    });

    // 2. Push run task to BullMQ
    await this.queueService.addJob("execute-workflow", {
      workflowId: id,
      executionId: execution.id,
      triggerNodeId: manualNode.id,
      triggerType: "manual",
      triggerPayload: payload || {},
    });

    return execution;
  }
}
