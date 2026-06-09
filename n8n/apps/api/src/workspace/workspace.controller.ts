import { Controller, Get, Patch, Body, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../prisma/prisma.service";

@Controller("workspace")
@UseGuards(AuthGuard("jwt"))
export class WorkspaceController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async getWorkspace(@Req() req: any) {
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { userId: req.user.id },
      include: {
        workspace: {
          include: {
            _count: {
              select: { members: true, workflows: true },
            },
          },
        },
      },
    });

    if (!membership) {
      return null;
    }

    return {
      id: membership.workspace.id,
      name: membership.workspace.name,
      role: membership.role,
      memberCount: membership.workspace._count.members,
      workflowCount: membership.workspace._count.workflows,
      createdAt: membership.workspace.createdAt,
    };
  }

  @Patch()
  async updateWorkspace(@Req() req: any, @Body("name") name: string) {
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { userId: req.user.id },
    });

    if (!membership) {
      return { error: "No workspace found" };
    }

    const updated = await this.prisma.workspace.update({
      where: { id: membership.workspaceId },
      data: { name },
    });

    return {
      id: updated.id,
      name: updated.name,
    };
  }
}
