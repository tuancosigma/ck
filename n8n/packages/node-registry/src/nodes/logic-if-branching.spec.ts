import { executeLogicIf } from "./logic.if";
import { NodeExecutionContext } from "@n8n-clone/workflow-core";

function makeCtx(config: Record<string, any>): NodeExecutionContext {
  return {
    nodeId: "node_if",
    nodeName: "IF",
    nodeType: "logic.if",
    config,
    input: {},
    credentials: {},
    signal: new AbortController().signal,
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  } as unknown as NodeExecutionContext;
}

describe("executeLogicIf — branch routing", () => {
  it.each([
    ["equal",        "foo",        "foo",   "true"],
    ["equal",        "foo",        "bar",   "false"],
    ["not_equal",    "a",          "b",     "true"],
    ["not_equal",    "x",          "x",     "false"],
    ["contains",     "hello world","world", "true"],
    ["contains",     "hello",      "xyz",   "false"],
    ["greater_than", "10",         "5",     "true"],
    ["greater_than", "3",          "5",     "false"],
    ["less_than",    "3",          "5",     "true"],
    ["less_than",    "10",         "5",     "false"],
  ] as [string, string, string, string][])(
    "operator=%s  v1=%s  v2=%s  → branch=%s",
    async (operator, value1, value2, expectedBranch) => {
      const ctx = makeCtx({ value1, operator, value2 });
      const result = await executeLogicIf(ctx);

      expect(result.status).toBe("success");
      expect(result.nextBranch).toBe(expectedBranch);
    }
  );

  it("returns failed for unknown operator", async () => {
    const ctx = makeCtx({ value1: "a", operator: "between", value2: "b" });
    const result = await executeLogicIf(ctx);

    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/unknown operator/i);
  });

  it("output includes value1, operator, value2, result", async () => {
    const ctx = makeCtx({ value1: "5", operator: "equal", value2: "5" });
    const result = await executeLogicIf(ctx);

    expect(result.output).toMatchObject({ value1: "5", operator: "equal", value2: "5", result: true });
  });
});
