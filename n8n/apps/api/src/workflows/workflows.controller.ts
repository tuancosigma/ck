import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req, ForbiddenException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { WorkflowsService } from "./workflows.service";
import { PrismaService } from "../prisma/prisma.service";

@Controller("workflows")
@UseGuards(AuthGuard("jwt"))
export class WorkflowsController {
  constructor(
    private workflowsService: WorkflowsService,
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
  async create(@Req() req: any, @Body("name") name: string, @Body("description") description?: string) {
    const wsId = await this.getWorkspaceId(req.user.id);
    return this.workflowsService.create(wsId, name, description);
  }

  @Get()
  async findAll(@Req() req: any) {
    const wsId = await this.getWorkspaceId(req.user.id);
    return this.workflowsService.findAll(wsId);
  }

  @Get(":id")
  async findOne(@Req() req: any, @Param("id") id: string) {
    const wsId = await this.getWorkspaceId(req.user.id);
    return this.workflowsService.findOne(wsId, id);
  }

  @Patch(":id")
  async update(
    @Req() req: any,
    @Param("id") id: string,
    @Body("name") name?: string,
    @Body("description") description?: string,
    @Body("graph") graph?: any
  ) {
    const wsId = await this.getWorkspaceId(req.user.id);
    return this.workflowsService.update(wsId, id, name, description, graph);
  }

  @Delete(":id")
  async remove(@Req() req: any, @Param("id") id: string) {
    const wsId = await this.getWorkspaceId(req.user.id);
    return this.workflowsService.remove(wsId, id);
  }

  @Post(":id/activate")
  async activate(@Req() req: any, @Param("id") id: string) {
    const wsId = await this.getWorkspaceId(req.user.id);
    return this.workflowsService.activate(wsId, id);
  }

  @Post(":id/deactivate")
  async deactivate(@Req() req: any, @Param("id") id: string) {
    const wsId = await this.getWorkspaceId(req.user.id);
    return this.workflowsService.deactivate(wsId, id);
  }

  @Post(":id/run")
  async run(@Req() req: any, @Param("id") id: string, @Body("payload") payload?: any) {
    const wsId = await this.getWorkspaceId(req.user.id);
    return this.workflowsService.run(wsId, id, payload);
  }
}
