import { NodeExecutionContext, NodeExecutionResult } from "@n8n-clone/workflow-core";
import { ExpressionResolver } from "../expression-resolver";

export const executeLogicIf = async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
  ctx.logger.info("Executing logic IF node.");

  // Resolve any expressions inside config values first
  const resolvedConfig = ExpressionResolver.resolve(ctx.config, ctx.input);

  const { value1, operator = "equal", value2 } = resolvedConfig;

  let result = false;

  switch (operator) {
    case "equal":
      result = String(value1) === String(value2);
      break;
    case "not_equal":
      result = String(value1) !== String(value2);
      break;
    case "contains":
      result = String(value1).toLowerCase().includes(String(value2).toLowerCase());
      break;
    case "greater_than":
      result = Number(value1) > Number(value2);
      break;
    case "less_than":
      result = Number(value1) < Number(value2);
      break;
    default:
      ctx.logger.error(`Unknown comparison operator: ${operator}`);
      return {
        status: "failed",
        error: `Unknown operator: ${operator}`,
      };
  }

  ctx.logger.info(`Comparison result for IF node: ${result} (Branch: "${result ? "true" : "false"}")`);

  return {
    status: "success",
    output: {
      value1,
      operator,
      value2,
      result,
    },
    nextBranch: result ? "true" : "false",
  };
};
