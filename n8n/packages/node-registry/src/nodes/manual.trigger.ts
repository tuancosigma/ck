import { NodeExecutionContext, NodeExecutionResult } from "@n8n-clone/workflow-core";

export const executeManualTrigger = async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
  ctx.logger.info("Executing manual trigger.");
  return {
    status: "success",
    output: ctx.input || {},
  };
};
