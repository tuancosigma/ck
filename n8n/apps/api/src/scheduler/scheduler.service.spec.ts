/**
 * Unit tests for SchedulerService — verifies G2 fix:
 * deregisterSchedules must only remove BullMQ repeatable jobs belonging
 * to the target workflowId, not jobs from other workflows with the same cron pattern.
 */
import { SchedulerService } from "./scheduler.service";

// ── Minimal mocks ────────────────────────────────────────────────────────────

const mockGetRepeatableJobs = jest.fn();
const mockRemoveRepeatableByKey = jest.fn();

const mockQueue = {
  getRepeatableJobs: mockGetRepeatableJobs,
  removeRepeatableByKey: mockRemoveRepeatableByKey,
};

const mockQueueService = {
  getQueue: jest.fn().mockReturnValue(mockQueue),
  addJob: jest.fn().mockResolvedValue({ id: "job-123" }),
};

const mockPrisma = {
  cronSchedule: {
    findMany: jest.fn(),
    create: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({}),
  },
};

function makeService(): SchedulerService {
  return new SchedulerService(mockQueueService as any, mockPrisma as any);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockQueueService.getQueue.mockReturnValue(mockQueue);
});

// ── deregisterSchedules (G2 scoping fix) ─────────────────────────────────────

describe("SchedulerService.deregisterSchedules", () => {
  it("removes only the job whose bullJobId matches the stored name — not same-pattern jobs from other workflows", async () => {
    const repeatableJobs = [
      { name: "cron:wf-A:node1", key: "key-A", pattern: "*/5 * * * *", tz: "UTC" },
      { name: "cron:wf-B:node1", key: "key-B", pattern: "*/5 * * * *", tz: "UTC" }, // same pattern, different wf
    ];
    mockGetRepeatableJobs.mockResolvedValue(repeatableJobs);
    mockPrisma.cronSchedule.findMany.mockResolvedValue([
      { workflowId: "wf-A", cron: "*/5 * * * *", timezone: "UTC", bullJobId: "cron:wf-A:node1" },
    ]);

    const service = makeService();
    await service.deregisterSchedules("wf-A");

    expect(mockRemoveRepeatableByKey).toHaveBeenCalledTimes(1);
    expect(mockRemoveRepeatableByKey).toHaveBeenCalledWith("key-A");
    expect(mockRemoveRepeatableByKey).not.toHaveBeenCalledWith("key-B");
    expect(mockPrisma.cronSchedule.deleteMany).toHaveBeenCalledWith({ where: { workflowId: "wf-A" } });
  });

  it("falls back to name-prefix filter when bullJobId is null (legacy rows)", async () => {
    const repeatableJobs = [
      { name: "cron:wf-legacy:node1", key: "key-legacy", pattern: "0 * * * *", tz: "UTC" },
      { name: "cron:wf-other:node1",  key: "key-other",  pattern: "0 * * * *", tz: "UTC" },
    ];
    mockGetRepeatableJobs.mockResolvedValue(repeatableJobs);
    mockPrisma.cronSchedule.findMany.mockResolvedValue([
      { workflowId: "wf-legacy", cron: "0 * * * *", timezone: "UTC", bullJobId: null },
    ]);

    const service = makeService();
    await service.deregisterSchedules("wf-legacy");

    // Should match by prefix "cron:wf-legacy:" + pattern
    expect(mockRemoveRepeatableByKey).toHaveBeenCalledTimes(1);
    expect(mockRemoveRepeatableByKey).toHaveBeenCalledWith("key-legacy");
    expect(mockRemoveRepeatableByKey).not.toHaveBeenCalledWith("key-other");
  });

  it("does nothing when no schedules exist for workflowId", async () => {
    mockPrisma.cronSchedule.findMany.mockResolvedValue([]);

    const service = makeService();
    await service.deregisterSchedules("wf-empty");

    expect(mockQueue.getRepeatableJobs).not.toHaveBeenCalled();
    expect(mockRemoveRepeatableByKey).not.toHaveBeenCalled();
    expect(mockPrisma.cronSchedule.deleteMany).toHaveBeenCalledWith({ where: { workflowId: "wf-empty" } });
  });
});

// ── registerSchedules (stores scoped bullJobId) ───────────────────────────────

describe("SchedulerService.registerSchedules", () => {
  it("adds a scoped job name and persists bullJobId in DB", async () => {
    const graph = {
      version: "1.0",
      nodes: [
        { id: "node-cron-1", type: "cron.trigger", name: "Every 5 min", position: { x: 0, y: 0 },
          config: { cron: "*/5 * * * *", timezone: "Asia/Ho_Chi_Minh" } },
      ],
      edges: [],
    };

    const service = makeService();
    await service.registerSchedules("wf-X", graph as any);

    // Job must be added with scoped name
    expect(mockQueueService.addJob).toHaveBeenCalledWith(
      "cron:wf-X:node-cron-1",
      expect.objectContaining({ workflowId: "wf-X", triggerNodeId: "node-cron-1" }),
      expect.objectContaining({ repeat: { pattern: "*/5 * * * *", tz: "Asia/Ho_Chi_Minh" } }),
    );

    // bullJobId stored in DB must match the scoped name
    expect(mockPrisma.cronSchedule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ bullJobId: "cron:wf-X:node-cron-1" }),
    });
  });

  it("skips registration when graph has no cron nodes", async () => {
    const graph = {
      version: "1.0",
      nodes: [
        { id: "node-1", type: "manual.trigger", name: "Manual", position: { x: 0, y: 0 }, config: {} },
      ],
      edges: [],
    };

    const service = makeService();
    await service.registerSchedules("wf-Y", graph as any);

    expect(mockQueueService.addJob).not.toHaveBeenCalled();
    expect(mockPrisma.cronSchedule.create).not.toHaveBeenCalled();
  });
});
