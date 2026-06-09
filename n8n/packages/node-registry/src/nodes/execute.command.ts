import { NodeExecutionContext, NodeExecutionResult } from "@n8n-clone/workflow-core";
import { ExpressionResolver } from "../expression-resolver";
import { exec } from "child_process";
import * as path from "path";
import * as fs from "fs";

export const executeSystemCommand = async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
  ctx.logger.info("Executing system command node.");

  const resolvedConfig = ExpressionResolver.resolve(ctx.config, ctx.input);
  const { command, cwd } = resolvedConfig;

  if (cwd && !fs.existsSync(cwd)) {
    return {
      status: "failed",
      error: `Working directory (CWD) "${cwd}" does not exist on the server.`,
    };
  }

  if (!command) {
    return {
      status: "failed",
      error: "Missing required parameter: 'command' is mandatory.",
    };
  }

  // Read timeout from node config (G8 fix): pass directly to exec() so the OS
  // kills the child process — not just rejects the Promise — after the limit.
  const timeoutMs = Number(ctx.config.timeoutMs) || 30000;

  return new Promise((resolve) => {
    ctx.logger.info(`Running command: "${command}" in working directory: "${cwd || process.cwd()}" (timeout: ${timeoutMs}ms)...`);

    const execOptions = {
      cwd: cwd ? path.resolve(cwd) : undefined,
      maxBuffer: 1024 * 1024 * 10, // 10MB stdout buffer
      timeout: timeoutMs,           // OS-level kill after N ms — engine AbortSignal alone is insufficient
      killSignal: "SIGTERM" as const,
    };

    exec(command, execOptions, (error, stdout, stderr) => {
      const resultOutput = {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: error ? error.code || 1 : 0,
      };

      if (error) {
        // Detect whether the process was killed due to timeout.
        // On Windows, error.signal is null even when killed — rely on error.killed alone.
        const isTimeout = (error as any).killed === true;
        const errorMsg = isTimeout
          ? `Command timed out after ${timeoutMs}ms`
          : (error.message || stderr);

        ctx.logger.error(`Command execution failed (exit ${resultOutput.exitCode}): ${errorMsg}`);
        resolve({
          status: "failed",
          error: errorMsg,
          output: resultOutput,
        });
      } else {
        ctx.logger.info(`Command completed successfully!`);
        resolve({
          status: "success",
          output: resultOutput,
        });
      }
    });
  });
};
