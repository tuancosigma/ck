import { executeSystemCommand } from "./execute.command";
import { NodeExecutionContext } from "@n8n-clone/workflow-core";

/** Minimal NodeExecutionContext stub for unit tests. */
function makeCtx(configOverrides: Record<string, any> = {}): NodeExecutionContext {
  return {
    nodeId: "node_test",
    nodeName: "Test Command",
    nodeType: "execute.command",
    config: configOverrides,
    input: {},
    credentials: {},
    signal: new AbortController().signal,
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
  } as unknown as NodeExecutionContext;
}

describe("executeSystemCommand", () => {
  it("succeeds with a fast echo command", async () => {
    const ctx = makeCtx({ command: process.platform === "win32" ? "echo hello" : "echo hello" });
    const result = await executeSystemCommand(ctx);

    expect(result.status).toBe("success");
    expect((result.output as any)?.stdout).toContain("hello");
    expect((result.output as any)?.exitCode).toBe(0);
  });

  it("returns failed status for non-zero exit code", async () => {
    const ctx = makeCtx({ command: process.platform === "win32" ? "exit 1" : "exit 1" });
    const result = await executeSystemCommand(ctx);
    expect(result.status).toBe("failed");
  });

  it("fails when command is missing", async () => {
    const ctx = makeCtx({});
    const result = await executeSystemCommand(ctx);
    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/command/i);
  });

  it("fails when CWD does not exist", async () => {
    const ctx = makeCtx({ command: "echo hi", cwd: "/path/that/does/not/exist/for/real" });
    const result = await executeSystemCommand(ctx);
    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/does not exist/i);
  });

  it("times out when command exceeds timeoutMs", async () => {
    // Windows: ping with a long delay is the reliable cross-platform sleep substitute.
    // `ping -n 6 127.0.0.1` waits ~5s (one echo per second, 6 rounds).
    // Unix: `sleep 5`. Both will be killed well before 150ms.
    const sleepCmd = process.platform === "win32"
      ? "ping -n 6 127.0.0.1"
      : "sleep 5";
    const ctx = makeCtx({ command: sleepCmd, timeoutMs: "150" });

    const result = await executeSystemCommand(ctx);

    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/timed out/i);
  }, 5000); // Jest timeout 5s — the command should be killed well within that
});
