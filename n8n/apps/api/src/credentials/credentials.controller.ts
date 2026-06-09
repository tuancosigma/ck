import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards, ForbiddenException } from "@nestjs/common";
import { CredentialsService } from "./credentials.service";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../prisma/prisma.service";
import { CredentialCreateInput } from "@n8n-clone/shared-types";

@Controller("credentials")
@UseGuards(AuthGuard("jwt"))
export class CredentialsController {
  constructor(
    private credentialsService: CredentialsService,
    private prisma: PrismaService
  ) {}

  private async getWorkspaceId(userId: string): Promise<string> {
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { userId },
    });
    if (!membership) {
      throw new ForbiddenException("No workspace membership found for this user context.");
    }
    return membership.workspaceId;
  }

  @Post()
  async create(@Req() req: any, @Body() body: CredentialCreateInput) {
    const wsId = await this.getWorkspaceId(req.user.id);
    return this.credentialsService.create(wsId, body);
  }

  @Get()
  async findAll(@Req() req: any) {
    const wsId = await this.getWorkspaceId(req.user.id);
    return this.credentialsService.findAll(wsId);
  }

  @Patch(":id")
  async update(@Req() req: any, @Param("id") id: string, @Body() body: Partial<CredentialCreateInput>) {
    const wsId = await this.getWorkspaceId(req.user.id);
    return this.credentialsService.update(wsId, id, body);
  }

  @Delete(":id")
  async remove(@Req() req: any, @Param("id") id: string) {
    const wsId = await this.getWorkspaceId(req.user.id);
    return this.credentialsService.remove(wsId, id);
  }
}
