/**
 * Unit tests for CredentialsService — verifies G6 fix:
 * - Re-encrypts with fresh IV+tag only when data is explicitly provided
 * - Name-only update must NOT touch encryptedData / iv / tag columns
 * - Returns 404 for unknown credential ID
 */
import { CredentialsService } from "./credentials.service";
import { NotFoundException } from "@nestjs/common";
import { EncryptionUtil } from "./encryption.util";

// ── Mock EncryptionUtil so tests never require a real ENCRYPTION_KEY env var ──
jest.mock("./encryption.util", () => ({
  EncryptionUtil: {
    encrypt: jest.fn().mockReturnValue({
      encryptedData: "enc-data",
      iv: "test-iv",
      tag: "test-tag",
    }),
    decrypt: jest.fn().mockReturnValue({ apiKey: "decrypted-key" }),
  },
}));

const mockPrisma = {
  credential: {
    findFirst:  jest.fn(),
    findUnique: jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
    delete:     jest.fn(),
    findMany:   jest.fn(),
  },
};

function makeService(): CredentialsService {
  return new CredentialsService(mockPrisma as any);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.credential.update.mockResolvedValue({
    id: "cred-1",
    name: "Updated",
    type: "openai",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
});

// ── update: re-encryption on data change ─────────────────────────────────────

describe("CredentialsService.update", () => {
  it("re-encrypts with fresh IV+tag when data is provided", async () => {
    mockPrisma.credential.findFirst.mockResolvedValue({
      id: "cred-1",
      workspaceId: "ws-1",
      name: "OpenAI",
      type: "openai",
    });

    const service = makeService();
    await service.update("ws-1", "cred-1", {
      data: { apiKey: "sk-new-key" },
    });

    // EncryptionUtil.encrypt must be called once with the new data
    expect(EncryptionUtil.encrypt).toHaveBeenCalledTimes(1);
    expect(EncryptionUtil.encrypt).toHaveBeenCalledWith({ apiKey: "sk-new-key" });

    // update call must include fresh encrypted columns
    expect(mockPrisma.credential.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          encryptedData: "enc-data",
          iv: "test-iv",
          tag: "test-tag",
        }),
      })
    );
  });

  it("does NOT call EncryptionUtil.encrypt on name-only update", async () => {
    mockPrisma.credential.findFirst.mockResolvedValue({
      id: "cred-1",
      workspaceId: "ws-1",
      name: "Old Name",
      type: "openai",
    });

    const service = makeService();
    await service.update("ws-1", "cred-1", { name: "New Name" });

    // No re-encryption triggered
    expect(EncryptionUtil.encrypt).not.toHaveBeenCalled();

    // update call must NOT include encrypted columns
    const callArgs = mockPrisma.credential.update.mock.calls[0][0];
    expect(callArgs.data).not.toHaveProperty("encryptedData");
    expect(callArgs.data).not.toHaveProperty("iv");
    expect(callArgs.data).not.toHaveProperty("tag");

    // Only name key should be present
    expect(callArgs.data).toEqual({ name: "New Name" });
  });

  it("does NOT re-encrypt when data is an empty object", async () => {
    mockPrisma.credential.findFirst.mockResolvedValue({
      id: "cred-1",
      workspaceId: "ws-1",
      name: "Existing",
      type: "slack",
    });

    const service = makeService();
    await service.update("ws-1", "cred-1", { data: {} });

    expect(EncryptionUtil.encrypt).not.toHaveBeenCalled();
  });

  it("throws NotFoundException for unknown credential", async () => {
    mockPrisma.credential.findFirst.mockResolvedValue(null);

    const service = makeService();
    await expect(
      service.update("ws-1", "non-existent-id", { name: "X" })
    ).rejects.toThrow(NotFoundException);

    expect(mockPrisma.credential.update).not.toHaveBeenCalled();
  });

  it("throws NotFoundException when credential belongs to different workspace", async () => {
    mockPrisma.credential.findFirst.mockResolvedValue(null); // findFirst with workspaceId filter returns null

    const service = makeService();
    await expect(
      service.update("ws-other", "cred-1", { name: "Hijack" })
    ).rejects.toThrow(NotFoundException);
  });
});

// ── create ────────────────────────────────────────────────────────────────────

describe("CredentialsService.create", () => {
  it("encrypts data and stores credential", async () => {
    mockPrisma.credential.create.mockResolvedValue({
      id: "cred-new",
      name: "Stripe",
      type: "stripe",
      createdAt: new Date(),
    });

    const service = makeService();
    const result = await service.create("ws-1", {
      name: "Stripe",
      type: "stripe",
      data: { secretKey: "sk_test_abc" },
    });

    expect(EncryptionUtil.encrypt).toHaveBeenCalledWith({ secretKey: "sk_test_abc" });
    expect(mockPrisma.credential.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: "ws-1",
          name: "Stripe",
          type: "stripe",
          encryptedData: "enc-data",
          iv: "test-iv",
          tag: "test-tag",
        }),
      })
    );
    expect(result.id).toBe("cred-new");
  });
});
