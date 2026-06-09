import { Injectable, Logger } from "@nestjs/common";
import { QueueService } from "../queue/queue.service";
import { PrismaService } from "../prisma/prisma.service";
import { WorkflowGraph } from "@n8n-clone/shared-types";

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private queueService: QueueService,
    private prisma: PrismaService
  ) {}

  /**
   * Registers cron triggers of an activated workflow in BullMQ.
   * Job name is scoped to workflowId + nodeId to prevent cross-workflow collision (G2 fix).
   */
  async registerSchedules(workflowId: string, graph: WorkflowGraph) {
    const { nodes } = graph;
    const cronNodes = nodes.filter((node) => node.type === "cron.trigger");

    for (const node of cronNodes) {
      const cronPattern = node.config?.cron || "*/5 * * * *";
      const timezone = node.config?.timezone || "UTC";
      // Scope job name to workflowId + nodeId — prevents two workflows with the same cron
      // pattern from removing each other's BullMQ jobs during deregister.
      const jobName = `cron:${workflowId}:${node.id}`;

      this.logger.log(`Registering cron trigger for workflow "${workflowId}" on node "${node.name}" (${cronPattern}, ${timezone})`);

      // Add repeatable job to BullMQ with scoped name.
      // Job data has no executionId — worker creates the Execution record on demand.
      await this.queueService.addJob(
        jobName,
        {
          workflowId,
          triggerNodeId: node.id,
          triggerType: "cron",
          triggerPayload: { cron: cronPattern, timezone, timestamp: new Date().toISOString() },
        },
        {
          repeat: {
            pattern: cronPattern,
            tz: timezone,
          },
        }
      );

      // Store the exact job name so deregisterSchedules can match precisely by name
      await this.prisma.cronSchedule.create({
        data: {
          workflowId,
          cron: cronPattern,
          timezone,
          bullJobId: jobName,
        },
      });
    }
  }

  /**
   * Removes repeatable cron schedules from BullMQ when workflow is deactivated.
   * Matches by stored bullJobId (job name) to avoid cross-workflow pattern collision (G2 fix).
   */
  async deregisterSchedules(workflowId: string) {
    const schedules = await this.prisma.cronSchedule.findMany({
      where: { workflowId },
    });

    if (schedules.length > 0) {
      try {
        const queue = this.queueService.getQueue();
        const repeatableJobs = await queue.getRepeatableJobs();

        for (const schedule of schedules) {
          this.logger.log(`Deregistering cron schedule from BullMQ for workflow "${workflowId}" (${schedule.cron})`);

          // Primary: match by stored bullJobId (exact job name). Fallback: name prefix filter.
          const matchingJobs = repeatableJobs.filter((job) =>
            schedule.bullJobId
              ? job.name === schedule.bullJobId
              : job.name?.startsWith(`cron:${workflowId}:`) && job.pattern === schedule.cron
          );

          for (const job of matchingJobs) {
            this.logger.log(`Removing repeatable job key: ${job.key}`);
            await queue.removeRepeatableByKey(job.key);
          }
        }
      } catch (e: any) {
        this.logger.error(`Failed to remove BullMQ repeatable job: ${e.message}`);
      }
    }

    // Delete schedule metadata from DB
    await this.prisma.cronSchedule.deleteMany({
      where: { workflowId },
    });
  }
}
