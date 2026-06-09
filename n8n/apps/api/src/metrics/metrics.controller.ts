import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../prisma/prisma.service";
import { QueueService } from "../queue/queue.service";

@Controller("metrics")
@UseGuards(AuthGuard("jwt"))
export class MetricsController {
  constructor(
    private prisma: PrismaService,
    private queueService: QueueService
  ) {}

  @Get()
  async getMetrics(@Req() req: any) {
    // Get workspace
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { userId: req.user.id },
      include: { workspace: true },
    });

    if (!membership) {
      return { error: "No workspace found" };
    }

    const workspaceId = membership.workspaceId;

    // Parallel fetch all stats
    const [
      totalWorkflows,
      activeWorkflows,
      totalExecutions,
      successExecutions,
      failedExecutions,
      runningExecutions,
      queuedExecutions,
      recentExecutions,
      totalCredentials,
    ] = await Promise.all([
      this.prisma.workflow.count({ where: { workspaceId } }),
      this.prisma.workflow.count({ where: { workspaceId, status: "ACTIVE" } }),
      this.prisma.execution.count({ where: { workflow: { workspaceId } } }),
      this.prisma.execution.count({ where: { workflow: { workspaceId }, status: "SUCCESS" } }),
      this.prisma.execution.count({ where: { workflow: { workspaceId }, status: "FAILED" } }),
      this.prisma.execution.count({ where: { workflow: { workspaceId }, status: "RUNNING" } }),
      this.prisma.execution.count({ where: { workflow: { workspaceId }, status: "QUEUED" } }),
      // Last 24h executions grouped by hour for chart
      this.prisma.execution.findMany({
        where: {
          workflow: { workspaceId },
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        select: { createdAt: true, status: true, finishedAt: true },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.credential.count({ where: { workspaceId } }),
    ]);

    // Compute success rate
    const successRate = totalExecutions > 0
      ? Math.round((successExecutions / totalExecutions) * 1000) / 10
      : 100;

    // Average duration from completed executions (fetch last 100 success runs)
    const completedExecs = await this.prisma.execution.findMany({
      where: {
        workflow: { workspaceId },
        status: "SUCCESS",
        finishedAt: { not: null },
      },
      select: { createdAt: true, finishedAt: true },
      orderBy: { finishedAt: "desc" },
      take: 100,
    });
    const totalDuration = completedExecs.reduce((sum, e) => {
      if (e.finishedAt) {
        return sum + (e.finishedAt.getTime() - e.createdAt.getTime());
      }
      return sum;
    }, 0);
    const avgDurationMs = completedExecs.length > 0 ? Math.round(totalDuration / completedExecs.length) : 0;

    // Group recent executions by hour for chart
    const hourlyData = buildHourlyChart(recentExecutions);

    // BullMQ queue stats
    let queueStats = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    try {
      const queue = this.queueService.getQueue();
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);
      queueStats = { waiting, active, completed, failed, delayed };
    } catch (e) {
      // Redis might not be available in dev
    }

    // Node.js process memory
    const memUsage = process.memoryUsage();

    return {
      workspace: {
        id: workspaceId,
        name: membership.workspace.name,
      },
      workflows: {
        total: totalWorkflows,
        active: activeWorkflows,
        inactive: totalWorkflows - activeWorkflows,
      },
      executions: {
        total: totalExecutions,
        success: successExecutions,
        failed: failedExecutions,
        running: runningExecutions,
        queued: queuedExecutions,
        successRate,
        avgDurationMs,
        cancelled: totalExecutions - successExecutions - failedExecutions - runningExecutions - queuedExecutions,
      },
      credentials: {
        total: totalCredentials,
      },
      queue: queueStats,
      process: {
        heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024),
        rssMb: Math.round(memUsage.rss / 1024 / 1024),
        uptimeSeconds: Math.round(process.uptime()),
      },
      chart: {
        hourly: hourlyData,
      },
    };
  }
}

function buildHourlyChart(executions: Array<{ createdAt: Date; status: string; finishedAt: Date | null }>) {
  // Build 7 most recent hour-buckets
  const now = new Date();
  const buckets: Array<{ time: string; executions: number; success: number; failed: number }> = [];

  for (let h = 6; h >= 0; h--) {
    const hourStart = new Date(now.getTime() - h * 60 * 60 * 1000);
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
    const label = hourStart.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

    const inBucket = executions.filter(
      (e) => e.createdAt >= hourStart && e.createdAt < hourEnd
    );

    buckets.push({
      time: label,
      executions: inBucket.length,
      success: inBucket.filter((e) => e.status === "SUCCESS").length,
      failed: inBucket.filter((e) => e.status === "FAILED").length,
    });
  }

  return buckets;
}
