import { NodeExecutionContext, NodeExecutionResult } from "@n8n-clone/workflow-core";
import { ExpressionResolver } from "../expression-resolver";

export const executeDelay = async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
  const resolvedConfig = ExpressionResolver.resolve(ctx.config, ctx.input);
  const seconds = Number(resolvedConfig.seconds) || 1;

  ctx.logger.info(`Delaying execution for ${seconds} seconds...`);

  if (seconds > 0) {
    await new Promise<void>((resolve, reject) => {
      if (ctx.signal?.aborted) {
        reject(new Error("Delay was cancelled."));
        return;
      }

      const timer = setTimeout(() => {
        resolve();
      }, seconds * 1000);

      // Handle abort signal
      if (ctx.signal) {
        ctx.signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new Error("Delay was cancelled."));
        });
      }
    });
  }

  ctx.logger.info("Delay finished.");
  return {
    status: "success",
    output: {
      delayedSeconds: seconds,
    },
  };
};
