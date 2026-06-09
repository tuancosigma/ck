import { NodeExecutionContext, NodeExecutionResult } from "@n8n-clone/workflow-core";

export const executeCronTrigger = async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
  ctx.logger.info("Executing cron trigger.");
  return {
    status: "success",
    output: {
      timestamp: new Date().toISOString(),
      cron: ctx.config?.cron || "* * * * *",
    },
  };
};
