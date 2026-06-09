import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { WorkerProcessor } from "./worker.processor";

@Module({
  imports: [PrismaModule],
  providers: [WorkerProcessor],
})
export class WorkerModule {}
