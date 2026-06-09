import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import Redis from "ioredis";

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private queue!: Queue;
  private redisConnection!: Redis;

  onModuleInit() {
    const redisHost = process.env.REDIS_HOST || "localhost";
    const redisPort = Number(process.env.REDIS_PORT) || 6379;

    this.redisConnection = new Redis({
      host: redisHost,
      port: redisPort,
      maxRetriesPerRequest: null, // Critical setting required by BullMQ
    });

    this.queue = new Queue("workflow-execution", {
      connection: this.redisConnection as any,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
  }

  getQueue(): Queue {
    return this.queue;
  }

  async addJob(name: string, data: any, opts?: any) {
    return this.queue.add(name, data, opts);
  }

  async removeRepeatableJob(name: string, pattern: string, jobId: string) {
    return this.queue.removeRepeatable(name, { pattern }, jobId);
  }

  async onModuleDestroy() {
    await this.queue.close().catch(() => {});
    this.redisConnection.disconnect();
  }
}
