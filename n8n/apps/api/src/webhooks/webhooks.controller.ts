import { Controller, Post, Body, Headers, Query, Param, Req, BadRequestException, GatewayTimeoutException, HttpCode, HttpStatus } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { QueueService } from "../queue/queue.service";

@Controller("webhooks")
export class WebhooksController {
  constructor(
    private prisma: PrismaService,
    private queueService: QueueService
  ) {}

  @Post(":workspaceId/:workflowId/:secret")
  @HttpCode(HttpStatus.ACCEPTED)
  async handleWebhook(
    @Param("workspaceId") workspaceId: string,
    @Param("workflowId") workflowId: string,
    @Param("secret") secret: string,
    @Body() body: any,
    @Headers() headers: any,
    @Query() query: any,
    @Req() req: any
  ) {
    // 1. Verify webhook endpoint configurations and active secret
    const endpoint = await this.prisma.webhookEndpoint.findFirst({
      where: {
        workflowId,
        secret,
        workflow: {
          workspaceId,
          status: "ACTIVE", // Only allow active webhooks
        },
      },
      include: { workflow: true },
    });

    if (!endpoint) {
      throw new BadRequestException("Webhook configuration is invalid or the workflow is inactive.");
    }

    // 2. Create the queued DB execution record
    const execution = await this.prisma.execution.create({
      data: {
        workflowId,
        version: endpoint.workflow.activeVersion,
        status: "QUEUED",
        triggerType: "webhook",
      },
    });

    const triggerNode = await this.prisma.workflowVersion.findUnique({
      where: {
        workflowId_version: {
          workflowId,
          version: endpoint.workflow.activeVersion,
        },
      },
    });

    // Find the webhook trigger node ID
    const graph: any = triggerNode?.graph;
    const webhookNode = graph?.nodes?.find((n: any) => n.type === "webhook.trigger");
    const triggerNodeId = webhookNode?.id || "node_1";

    const payload = {
      body: body || {},
      headers: headers || {},
      query: query || {},
      method: req.method || "POST",
    };

    // 3. Dispatch workflow job to BullMQ
    await this.queueService.addJob("execute-workflow", {
      workflowId,
      executionId: execution.id,
      triggerNodeId,
      triggerType: "webhook",
      triggerPayload: payload,
    });

    // 4. Synchronous execution support: poll db status for up to 30s
    if (endpoint.syncMode) {
      const pollStart = Date.now();
      const timeoutLimitMs = 30000; // 30s limit

      while (Date.now() - pollStart < timeoutLimitMs) {
        const checkExec = await this.prisma.execution.findUnique({
          where: { id: execution.id },
          include: {
            steps: {
              orderBy: { createdAt: "desc" },
            },
          },
        });

        if (!checkExec) {
          throw new BadRequestException("Execution log was unexpectedly truncated.");
        }

        if (checkExec.status === "SUCCESS") {
          // Sync Mode returns the output of the final executed node
          const finalStep = checkExec.steps[0];
          return finalStep ? finalStep.output : { success: true };
        }

        if (checkExec.status === "FAILED") {
          throw new BadRequestException(`Workflow execution failed: ${checkExec.error}`);
        }

        // Suspend event loop briefly
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      throw new GatewayTimeoutException("Synchronous webhook execution timed out after 30 seconds.");
    }

    // 5. Immediate Mode: Return execution reference
    return {
      executionId: execution.id,
      status: "QUEUED",
    };
  }
}
