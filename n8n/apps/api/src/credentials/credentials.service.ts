import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EncryptionUtil } from "./encryption.util";
import { CredentialCreateInput } from "@n8n-clone/shared-types";

@Injectable()
export class CredentialsService {
  constructor(private prisma: PrismaService) {}

  async create(workspaceId: string, input: CredentialCreateInput) {
    const { name, type, data } = input;

    // Encrypt the sensitive fields
    const { encryptedData, iv, tag } = EncryptionUtil.encrypt(data);

    return this.prisma.credential.create({
      data: {
        workspaceId,
        name,
        type,
        encryptedData,
        iv,
        tag,
      },
      select: {
        id: true,
        name: true,
        type: true,
        createdAt: true,
      },
    });
  }

  async findAll(workspaceId: string) {
    return this.prisma.credential.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        type: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Partial update - re-encrypts with a fresh IV+tag when data is provided.
   * Never patches existing ciphertext in place (G6 fix).
   */
  async update(workspaceId: string, id: string, input: Partial<CredentialCreateInput>) {
    const existing = await this.prisma.credential.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException("Credential not found.");
    }

    const updateData: Record<string, any> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.type !== undefined) updateData.type = input.type;

    // Only re-encrypt when data is explicitly provided (prevents leaking the old key on name-only updates)
    if (input.data && Object.keys(input.data).length > 0) {
      const { encryptedData, iv, tag } = EncryptionUtil.encrypt(input.data);
      Object.assign(updateData, { encryptedData, iv, tag });
    }

    return this.prisma.credential.update({
      where: { id },
      data: updateData,
      // Never return encrypted fields - safe projection only
      select: {
        id: true,
        name: true,
        type: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(workspaceId: string, id: string) {
    const cred = await this.prisma.credential.findFirst({
      where: { id, workspaceId },
    });

    if (!cred) {
      throw new NotFoundException("Credential not found.");
    }

    return this.prisma.credential.delete({
      where: { id },
    });
  }

  /**
   * Internal decryption helper for workflow execution tasks.
   * Access to decrypted fields is isolated here.
   */
  async getDecryptedCredential(id: string): Promise<Record<string, any>> {
    const cred = await this.prisma.credential.findUnique({
      where: { id },
    });

    if (!cred) {
      throw new NotFoundException(`Credential with ID ${id} not found.`);
    }

    return EncryptionUtil.decrypt(cred.encryptedData, cred.iv, cred.tag);
  }
}
