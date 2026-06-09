import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { QueueModule } from "./queue/queue.module";
import { AuthModule } from "./auth/auth.module";
import { WorkflowsModule } from "./workflows/workflows.module";
import { CredentialsModule } from "./credentials/credentials.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { ExecutionsModule } from "./executions/executions.module";
import { MetricsModule } from "./metrics/metrics.module";
import { WorkspaceModule } from "./workspace/workspace.module";

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    AuthModule,
    WorkflowsModule,
    CredentialsModule,
    WebhooksModule,
    ExecutionsModule,
    MetricsModule,
    WorkspaceModule,
  ],
})
export class AppModule {}

