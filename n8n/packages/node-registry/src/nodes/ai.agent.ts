import { NodeExecutionContext, NodeExecutionResult } from "@n8n-clone/workflow-core";
import { ExpressionResolver } from "../expression-resolver";

// Convenience alias
function resolveExpression(template: string, input: any): string {
  if (!template) return "";
  const result = ExpressionResolver.resolveString(template, input);
  return typeof result === "object" ? JSON.stringify(result) : String(result ?? "");
}

/**
 * AI Agent Node Executor
 * Supports: OpenAI (GPT-4o, GPT-4, GPT-3.5-turbo), Anthropic (Claude), Google Gemini
 * Config:
 *   - provider: "openai" | "anthropic" | "gemini"  (default: openai)
 *   - model: string  (default: gpt-4o-mini)
 *   - systemPrompt: string  (supports {{expression}} templates)
 *   - userMessage: string   (supports {{expression}} templates, falls through if empty → uses input)
 *   - temperature: number   (0–2, default: 0.7)
 *   - maxTokens: number     (default: 2048)
 *   - jsonMode: boolean     (force JSON output format)
 */
export async function executeAiAgent(ctx: NodeExecutionContext): Promise<NodeExecutionResult> {
  const {
    config,
    credentials,
    input,
    signal,
    logger,
  } = ctx;

  const provider = config?.provider || "openai";
  // Per-provider default model — fixes a latent bug where a single "gpt-4o-mini" default
  // was sent to every provider (e.g. an invalid model for groq/anthropic/gemini).
  const defaultModels: Record<string, string> = {
    openai: "gpt-4o-mini",
    groq: "llama-3.3-70b-versatile",
    anthropic: "claude-3-5-sonnet-20241022",
    gemini: "gemini-2.0-flash",
  };
  const model = config?.model || defaultModels[provider] || "gpt-4o-mini";
  const temperature = parseFloat(String(config?.temperature ?? "0.7"));
  const maxTokens = parseInt(String(config?.maxTokens ?? "2048"), 10);
  const jsonMode = Boolean(config?.jsonMode);

  // Resolve expressions in prompts against the current node's input data
  const inputData = typeof input === "object" ? input : { text: String(input ?? "") };

  const rawSystemPrompt = config?.systemPrompt || "You are a helpful AI assistant.";
  const rawUserMessage = config?.userMessage || "{{$json}}";

  const systemPrompt = resolveExpression(rawSystemPrompt, inputData);
  const userMessage = resolveExpression(rawUserMessage, inputData);

  // Retrieve API key from credentials — credential should be mapped as "apiKey" in node
  const apiKey = credentials?.apiKey?.key || credentials?.apiKey?.apiKey;
  if (!apiKey) {
    return {
      status: "failed",
      error: `No API key credential provided for AI Agent node. Please add a credential with an 'apiKey' field and map it to this node.`,
    };
  }

  // Load agent tools metadata if configured
  const tools = config?.tools || [];
  let toolsMetadata: any[] = [];
  if (Array.isArray(tools) && tools.length > 0 && ctx.fetchWorkflowsMetadata) {
    try {
      toolsMetadata = await ctx.fetchWorkflowsMetadata(tools);
      logger.info(`Loaded ${toolsMetadata.length} agent tools successfully.`);
    } catch (e: any) {
      logger.error(`Failed to fetch agent tools metadata: ${e.message}`);
    }
  }

  logger.info(`Calling ${provider} / ${model} (temp: ${temperature}, maxTokens: ${maxTokens})`);

  try {
    // OpenAI and Groq share the exact same Chat Completions API contract (Groq is OpenAI-compatible),
    // so they route through one implementation differing only by endpoint + provider label.
    if (provider === "openai" || provider === "groq") {
      return await callOpenAICompatible({
        endpoint: provider === "groq"
          ? "https://api.groq.com/openai/v1/chat/completions"
          : "https://api.openai.com/v1/chat/completions",
        providerLabel: provider,
        apiKey,
        model,
        systemPrompt,
        userMessage,
        temperature,
        maxTokens,
        jsonMode,
        signal,
        toolsMetadata,
        runSubWorkflow: ctx.runSubWorkflow,
        logger,
      });
    } else if (provider === "anthropic") {
      return await callAnthropic({ apiKey, model, systemPrompt, userMessage, temperature, maxTokens, signal });
    } else if (provider === "gemini") {
      return await callGemini({ apiKey, model, systemPrompt, userMessage, temperature, maxTokens, signal });
    } else {
      return { status: "failed", error: `Unsupported AI provider: "${provider}"` };
    }
  } catch (err: any) {
    logger.error(`AI Agent call failed: ${err.message}`);
    return { status: "failed", error: err.message };
  }
}

// ─── OpenAI-compatible (OpenAI + Groq) ───────────────────────────────────────
async function callOpenAICompatible(params: {
  endpoint: string;
  providerLabel: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userMessage: string;
  temperature: number;
  maxTokens: number;
  jsonMode: boolean;
  signal?: AbortSignal;
  toolsMetadata?: any[];
  runSubWorkflow?: (workflowId: string, payload: any) => Promise<any>;
  logger?: any;
}): Promise<NodeExecutionResult> {
  const { endpoint, providerLabel, apiKey, model, systemPrompt, userMessage, temperature, maxTokens, jsonMode, signal, toolsMetadata = [], runSubWorkflow, logger } = params;

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  // Map toolsMetadata to OpenAI tools format
  const openAiTools = toolsMetadata.map((w: any) => ({
    type: "function",
    function: {
      name: `wf_${w.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`, // conform with OpenAI name regex
      description: `${w.name}${w.description ? `: ${w.description}` : ""} (Triggers automated sub-workflow)`,
      parameters: {
        type: "object",
        properties: {
          payload: {
            type: "object",
            description: "JSON payload arguments passed directly to the trigger node"
          }
        },
        required: ["payload"]
      }
    }
  }));

  const hasTools = openAiTools.length > 0 && !!runSubWorkflow;

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalTotalTokens = 0;
  let finalChoice: any = null;

  // Reasoning / Tool Call loop (max 10 iterations to prevent runaway)
  let loopCount = 0;
  const maxLoops = 10;

  while (loopCount < maxLoops) {
    loopCount++;

    const body: any = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    if (jsonMode) {
      body.response_format = { type: "json_object" };
    }

    if (hasTools) {
      body.tools = openAiTools;
      body.tool_choice = "auto";
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`${providerLabel} API error ${response.status}: ${err?.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error(`${providerLabel} API returned an empty choices array.`);
    }

    const usage = data.usage || {};
    totalPromptTokens += usage.prompt_tokens || 0;
    totalCompletionTokens += usage.completion_tokens || 0;
    totalTotalTokens += usage.total_tokens || 0;

    finalChoice = choice;

    const assistantMessage = choice.message;
    const toolCalls = assistantMessage?.tool_calls;

    if (toolCalls && toolCalls.length > 0 && hasTools) {
      // Add assistant's tool calls to the message history
      messages.push(assistantMessage);

      // Execute each tool call
      for (const toolCall of toolCalls) {
        const sanitizedName = toolCall.function.name;
        // Find which workflow this toolCall refers to
        const matchedTool = toolsMetadata.find((w: any) => {
          const targetName = `wf_${w.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
          return targetName === sanitizedName;
        });

        if (!matchedTool) {
          logger?.error(`Tool call requested unknown workflow function: ${sanitizedName}`);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: sanitizedName,
            content: JSON.stringify({ error: `Unknown workflow function "${sanitizedName}"` })
          });
          continue;
        }

        let payload = {};
        try {
          const args = JSON.parse(toolCall.function.arguments || "{}");
          payload = args.payload || args || {};
        } catch (e: any) {
          logger?.error(`Failed to parse arguments for tool call ${toolCall.id}: ${e.message}`);
        }

        logger?.info(`[AGENT TOOL] Invoking sub-workflow "${matchedTool.name}" (${matchedTool.id}) with payload: ${JSON.stringify(payload)}`);

        try {
          const subOutputs = await runSubWorkflow!(matchedTool.id, payload);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: sanitizedName,
            content: JSON.stringify(subOutputs)
          });
        } catch (err: any) {
          logger?.error(`[AGENT TOOL] Sub-workflow execution failed: ${err.message}`);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: sanitizedName,
            content: JSON.stringify({ error: err.message || "Workflow execution failed" })
          });
        }
      }
    } else {
      // No tool calls needed, we are done
      break;
    }
  }

  if (!finalChoice) {
    throw new Error("No response from AI model.");
  }

  const text = finalChoice.message?.content || "";
  const finishReason = finalChoice.finish_reason || "stop";

  let parsedOutput: any = { text };
  if (jsonMode) {
    try {
      parsedOutput = { ...parsedOutput, json: JSON.parse(text) };
    } catch {}
  }

  return {
    status: "success",
    output: {
      ...parsedOutput,
      model,
      provider: providerLabel,
      finishReason,
      tokens: {
        prompt: totalPromptTokens,
        completion: totalCompletionTokens,
        total: totalTotalTokens,
      },
    },
  };
}

// ─── Anthropic ───────────────────────────────────────────────────────────────
async function callAnthropic(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userMessage: string;
  temperature: number;
  maxTokens: number;
  signal?: AbortSignal;
}): Promise<NodeExecutionResult> {
  const { apiKey, model, systemPrompt, userMessage, temperature, maxTokens, signal } = params;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      temperature,
      max_tokens: maxTokens,
    }),
    signal,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Anthropic API error ${response.status}: ${err?.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || "";
  const usage = data.usage || {};

  return {
    status: "success",
    output: {
      text,
      model,
      provider: "anthropic",
      finishReason: data.stop_reason || "end_turn",
      tokens: {
        prompt: usage.input_tokens || 0,
        completion: usage.output_tokens || 0,
        total: (usage.input_tokens || 0) + (usage.output_tokens || 0),
      },
    },
  };
}

// ─── Google Gemini ───────────────────────────────────────────────────────────
async function callGemini(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userMessage: string;
  temperature: number;
  maxTokens: number;
  signal?: AbortSignal;
}): Promise<NodeExecutionResult> {
  const { apiKey, model, systemPrompt, userMessage, temperature, maxTokens, signal } = params;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    }),
    signal,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Gemini API error ${response.status}: ${err?.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const tokenMeta = data.usageMetadata || {};

  return {
    status: "success",
    output: {
      text,
      model,
      provider: "gemini",
      finishReason: data.candidates?.[0]?.finishReason || "STOP",
      tokens: {
        prompt: tokenMeta.promptTokenCount || 0,
        completion: tokenMeta.candidatesTokenCount || 0,
        total: tokenMeta.totalTokenCount || 0,
      },
    },
  };
}
