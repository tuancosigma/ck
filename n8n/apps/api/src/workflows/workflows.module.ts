import { Module } from "@nestjs/common";
import { WorkflowsService } from "./workflows.service";
import { WorkflowsController } from "./workflows.controller";
import { SchedulerModule } from "../scheduler/scheduler.module";

@Module({
  imports: [SchedulerModule],
  providers: [WorkflowsService],
  controllers: [WorkflowsController],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
