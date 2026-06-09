import { Controller, Get, Post, Param, Req, Res, UseGuards, NotFoundException, Query } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Response } from "express";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";

@Controller("executions")
@UseGuards(AuthGuard("jwt"))
export class ExecutionsController {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  @Get()
  async findAll(
    @Req() req: any,
    @Query("workflowId") workflowId?: string,
    @Query("status") status?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    // Return executions in the user's workspace
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { userId: req.user.id },
    });

    if (!membership) {
      return [];
    }

    const take = Math.min(Number(limit) || 50, 200); // Max 200 rows per request
    const skip = Number(offset) || 0;

    const where: any = {
      workflow: {
        workspaceId: membership.workspaceId,
      },
    };

    if (workflowId) {
      where.workflowId = workflowId;
    }

    if (status) {
      where.status = status;
    }

    return this.prisma.execution.findMany({
      where,
      include: {
        workflow: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    });
  }

  @Get(":id")
  async findOne(@Req() req: any, @Param("id") id: string) {
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { userId: req.user.id },
    });

    const execution = await this.prisma.execution.findFirst({
      where: {
        id,
        workflow: {
          workspaceId: membership?.workspaceId,
        },
      },
      include: {
        steps: {
          orderBy: { createdAt: "asc" },
        },
        workflow: {
          include: {
            versions: true,
          },
        },
      },
    });

    if (!execution) {
      throw new NotFoundException("Execution history record not found.");
    }

    return execution;
  }

  /**
   * GET /executions/:id/stream — Server-Sent Events for real-time node status updates.
   * Browsers cannot send Authorization headers with EventSource, so we accept the JWT
   * via the ?token= query param for this endpoint only (no cookie-based auth in this stack).
   */
  @Get(":id/stream")
  @UseGuards() // Override class-level guard — token verified manually below
  async streamExecution(
    @Req() req: any,
    @Param("id") id: string,
    @Query("token") token: string,
    @Res() res: Response,
  ) {
    // Verify the JWT from query param
    let userId: string;
    try {
      const payload = this.jwtService.verify(token);
      userId = payload.sub;
    } catch {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const membership = await this.prisma.workspaceMember.findFirst({
      where: { userId },
    });

    const execution = await this.prisma.execution.findFirst({
      where: { id, workflow: { workspaceId: membership?.workspaceId } },
    });

    if (!execution) {
      res.status(404).json({ message: "Execution not found." });
      return;
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering if applicable
    res.flushHeaders();

    const send = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // If already terminal, emit final state immediately and close
    const terminalStatuses = ["SUCCESS", "FAILED", "CANCELLED"];
    if (terminalStatuses.includes(execution.status)) {
      const steps = await this.prisma.executionStep.findMany({
        where: { executionId: id },
        orderBy: { startedAt: "asc" },
      });
      for (const step of steps) {
        send("step", { nodeId: step.nodeId, nodeName: step.nodeName,
          nodeType: step.nodeType, status: step.status, durationMs: step.durationMs ?? null });
      }
      send("execution", { status: execution.status, finishedAt: execution.finishedAt, error: execution.error });
      send("done", {});
      res.end();
      return;
    }

    // Poll DB at 100ms intervals, emit steps for new rows AND status changes on existing rows.
    // Track by nodeId → last emitted status so RUNNING → SUCCESS transitions are re-emitted.
    const emittedStepStatus = new Map<string, string>();
    let done = false;

    const poll = setInterval(async () => {
      if (done) { clearInterval(poll); return; }

      try {
        const current = await this.prisma.execution.findUnique({
          where: { id },
          include: { steps: { orderBy: { startedAt: "asc" } } },
        });

        if (!current) { clearInterval(poll); res.end(); return; }

        // Emit step when it's new OR its status changed since last emission
        for (const step of current.steps) {
          if (emittedStepStatus.get(step.nodeId) !== step.status) {
            send("step", { nodeId: step.nodeId, nodeName: step.nodeName,
              nodeType: step.nodeType, status: step.status, durationMs: step.durationMs ?? null });
            emittedStepStatus.set(step.nodeId, step.status);
          }
        }

        // Emit terminal execution state and close stream
        if (terminalStatuses.includes(current.status)) {
          send("execution", { status: current.status, finishedAt: current.finishedAt, error: current.error });
          send("done", {});
          done = true;
          clearInterval(poll);
          res.end();
        }
      } catch {
        clearInterval(poll);
        res.end();
      }
    }, 100);

    // Clean up on client disconnect
    req.on("close", () => { done = true; clearInterval(poll); });
  }

  @Post(":id/cancel")
  async cancel(@Req() req: any, @Param("id") id: string) {
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { userId: req.user.id },
    });

    const execution = await this.prisma.execution.findFirst({
      where: {
        id,
        workflow: {
          workspaceId: membership?.workspaceId,
        },
      },
    });

    if (!execution) {
      throw new NotFoundException("Execution history record not found.");
    }

    // Update execution status in DB.
    // The worker checks this status or is notified via abort signals.
    return this.prisma.execution.update({
      where: { id },
      data: {
        status: "CANCELLED",
        finishedAt: new Date(),
      },
    });
  }
}
