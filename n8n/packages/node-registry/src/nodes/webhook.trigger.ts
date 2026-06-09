import { NodeExecutionContext, NodeExecutionResult } from "@n8n-clone/workflow-core";

export const executeWebhookTrigger = async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
  ctx.logger.info("Executing webhook trigger.");
  return {
    status: "success",
    output: {
      body: ctx.input?.body || {},
      headers: ctx.input?.headers || {},
      query: ctx.input?.query || {},
      method: ctx.input?.method || "POST",
    },
  };
};
