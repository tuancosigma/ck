/**
 * Unit tests for WorkflowsService — verifies G1 fix:
 * When an ACTIVE workflow's graph is saved, the service must:
 * 1. Deregister old cron schedules
 * 2. Register new cron schedules from updated graph
 * 3. Rotate webhook endpoints
 *
 * INACTIVE workflows must NOT trigger any of those side effects.
 */
import { WorkflowsService } from "./workflows.service";
import { BadRequestException, NotFoundException } from "@nestjs/common";

// ── Minimal mocks ─────────────────────────────────────────────────────────────

const mockDeregisterSchedules = jest.fn().mockResolvedValue(undefined);
const mockRegisterSchedules   = jest.fn().mockResolvedValue(undefined);

const mockSchedulerService = {
  deregisterSchedules: mockDeregisterSchedules,
  registerSchedules:   mockRegisterSchedules,
};

const mockQueueService = {};

// Prisma mock — returns controllable workflow fixture
const mockPrisma = {
  workflow: {
    findFirst:    jest.fn(),
    update:       jest.fn(),
  },
  workflowVersion: {
    findUnique:   jest.fn(),
    create:       jest.fn().mockResolvedValue({}),
  },
  webhookEndpoint: {
    findMany:     jest.fn().mockResolvedValue([]),
    deleteMany:   jest.fn().mockResolvedValue({}),
    create:       jest.fn().mockResolvedValue({}),
  },
  $transaction: jest.fn(),
};

function makeService(): WorkflowsService {
  return new WorkflowsService(mockPrisma as any, mockQueueService as any, mockSchedulerService as any);
}

// Helper builds a minimal valid WorkflowGraph
function makeGraph(nodeType = "manual.trigger") {
  return {
    version: "1.0",
    nodes: [
      { id: "node-1", type: nodeType, name: "Trigger", position: { x: 0, y: 0 }, config: {
        cron: "*/10 * * * *",
        timezone: "UTC",
      }},
    ],
    edges: [],
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  // Default $transaction: run callback immediately
  mockPrisma.$transaction.mockImplementation((cb: any) =>
    typeof cb === "function"
      ? cb(mockPrisma)
      : Promise.resolve()
  );

  mockPrisma.workflow.update.mockResolvedValue({
    id: "wf-1",
    workspaceId: "ws-1",
    name: "Test WF",
    status: "ACTIVE",
    activeVersion: 2,
  });

  mockPrisma.workflowVersion.findUnique.mockResolvedValue({
    graph: makeGraph(),
  });

  mockPrisma.webhookEndpoint.findMany.mockResolvedValue([]);
});

// ── G1: ACTIVE workflow — triggers reload ─────────────────────────────────────

describe("WorkflowsService.update — G1 active workflow auto-reload", () => {
  it("calls deregisterSchedules + registerSchedules when workflow is ACTIVE and graph changes", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue({
      id: "wf-1",
      workspaceId: "ws-1",
      status: "ACTIVE",
      activeVersion: 1,
    });

    const service = makeService();
    const graph = makeGraph("cron.trigger");
    await service.update("ws-1", "wf-1", undefined, undefined, graph as any);

    expect(mockDeregisterSchedules).toHaveBeenCalledWith("wf-1");
    expect(mockRegisterSchedules).toHaveBeenCalledWith("wf-1", graph);
  });

  it("rotates webhook endpoints for ACTIVE workflow with webhook trigger nodes", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue({
      id: "wf-1",
      workspaceId: "ws-1",
      status: "ACTIVE",
      activeVersion: 1,
    });

    const graph = {
      version: "1.0",
      nodes: [
        { id: "wh-1", type: "webhook.trigger", name: "Hook", position: { x: 0, y: 0 },
          config: { responseMode: "sync" } },
      ],
      edges: [],
    };

    const service = makeService();
    await service.update("ws-1", "wf-1", undefined, undefined, graph as any);

    // Old endpoints wiped first
    expect(mockPrisma.webhookEndpoint.deleteMany).toHaveBeenCalledWith({ where: { workflowId: "wf-1" } });
    // New endpoint created for the webhook node
    expect(mockPrisma.webhookEndpoint.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.webhookEndpoint.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ workflowId: "wf-1", syncMode: true }) })
    );
  });
});

// ── INACTIVE workflow — no reload side effects ────────────────────────────────

describe("WorkflowsService.update — INACTIVE workflow skips reload", () => {
  it("does NOT call deregisterSchedules or registerSchedules for INACTIVE workflow", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue({
      id: "wf-2",
      workspaceId: "ws-1",
      status: "INACTIVE",
      activeVersion: 1,
    });
    mockPrisma.workflow.update.mockResolvedValue({
      id: "wf-2",
      workspaceId: "ws-1",
      status: "INACTIVE",
      activeVersion: 2,
    });

    const service = makeService();
    await service.update("ws-1", "wf-2", undefined, undefined, makeGraph() as any);

    expect(mockDeregisterSchedules).not.toHaveBeenCalled();
    expect(mockRegisterSchedules).not.toHaveBeenCalled();
    expect(mockPrisma.webhookEndpoint.deleteMany).not.toHaveBeenCalled();
  });
});

// ── Not found ─────────────────────────────────────────────────────────────────

describe("WorkflowsService.update — not found", () => {
  it("throws NotFoundException when workflow does not belong to workspace", async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(null);

    const service = makeService();
    await expect(
      service.update("ws-bad", "wf-1", "New Name", undefined, undefined)
    ).rejects.toThrow(NotFoundException);
  });
});
