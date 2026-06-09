import { NodeExecutionContext, NodeExecutionResult } from "@n8n-clone/workflow-core";
import * as vm from "vm";

export const executeCodeJavascript = async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
  ctx.logger.info("Executing custom Javascript sandbox node.");

  const userCode = ctx.config.code;
  if (!userCode) {
    return {
      status: "failed",
      error: "No JavaScript code provided in node config.",
    };
  }

  // Construct standard $input and $json shortcuts for their sandbox context
  const parentKeys = Object.keys(ctx.input || {});
  const parentKey = parentKeys.includes("trigger") ? "trigger" : parentKeys[0];
  const $json = parentKey ? ctx.input[parentKey] : {};

  // Setup sandbox variables
  const sandboxOutput = { value: {} };
  const sandbox = {
    $input: ctx.input,
    $json,
    $config: ctx.config,
    $output: sandboxOutput,
    console: {
      log: (...args: any[]) => ctx.logger.info(args.join(" ")),
      error: (...args: any[]) => ctx.logger.error(args.join(" ")),
    },
    // Safe utilities
    Buffer,
    URL,
    setTimeout,
    clearTimeout,
  };

  // Wrap user code in an async IIFE to support await out of the box.
  // We capture what is returned, or if they write to '$output.value'.
  const wrappedCode = `
    (async () => {
      ${userCode}
    })()
  `;

  const timeoutMs = Number(ctx.config.timeoutMs) || 5000;

  try {
    const context = vm.createContext(sandbox);
    const script = new vm.Script(wrappedCode);

    ctx.logger.info(`Running script with timeout of ${timeoutMs}ms...`);
    const promiseResult = script.runInContext(context, { timeout: timeoutMs });

    // vm timeout only covers synchronous execution — the async IIFE body can still
    // run indefinitely after the initial synchronous parse+start. Wrap with an outer
    // Promise.race so the overall async execution is also bounded.
    const timeoutGuard = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Script exceeded timeout of ${timeoutMs}ms`)), timeoutMs)
    );
    const result = await Promise.race([promiseResult, timeoutGuard]);

    // Use returned value or fallback to writing into $output.value
    const finalOutput = result !== undefined ? result : sandboxOutput.value;

    return {
      status: "success",
      output: finalOutput || {},
    };
  } catch (err: any) {
    ctx.logger.error(`Sandbox execution failed: ${err.message}`);
    return {
      status: "failed",
      error: `JavaScript execution error: ${err.message}`,
    };
  }
};
