import { NodeExecutionContext, NodeExecutionResult } from "@n8n-clone/workflow-core";
import { ExpressionResolver } from "../expression-resolver";

/**
 * AI Embeddings Node Executor
 * Generates vector embeddings for a given string or array of strings.
 * Supports: OpenAI (text-embedding-3-small, text-embedding-ada-002), Google Gemini (text-embedding-004)
 * 
 * Config:
 *   - provider: "openai" | "gemini"  (default: openai)
 *   - model: string  (default: text-embedding-3-small)
 * 
 * Input:
 *   - A text string, an array of strings, or an array of chunk objects: [{ text: "..." }]
 */
export async function executeAiEmbeddings(ctx: NodeExecutionContext): Promise<NodeExecutionResult> {
  ctx.logger.info("Executing AI Embeddings node.");

  const provider = ctx.config?.provider || "openai";
  const model = ctx.config?.model || (provider === "gemini" ? "text-embedding-004" : "text-embedding-3-small");

  // Get API key from credentials
  const apiKey = ctx.credentials?.apiKey?.key || ctx.credentials?.apiKey?.apiKey;
  if (!apiKey) {
    return {
      status: "failed",
      error: `No API key credential provided for AI Embeddings node. Please map an 'apiKey' credential to this node.`,
    };
  }

  // Parse input to gather text strings to embed
  let textsToEmbed: string[] = [];
  let isArrayInput = false;

  const rawInput = ctx.input;
  if (typeof rawInput === "string") {
    textsToEmbed = [rawInput];
  } else if (Array.isArray(rawInput)) {
    isArrayInput = true;
    textsToEmbed = rawInput.map(item => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") return String(item.text || item.content || JSON.stringify(item));
      return String(item ?? "");
    });
  } else if (rawInput && typeof rawInput === "object") {
    // If input is the output of the Chunker node: { chunks: [{ text: "..." }] }
    if (Array.isArray(rawInput.chunks)) {
      isArrayInput = true;
      textsToEmbed = rawInput.chunks.map((c: any) => String(c.text || c.content || JSON.stringify(c)));
    } else {
      // Resolve string expression or fallback to json string
      const rawExpression = ctx.config?.text || "{{$json.text}}";
      const resolved = ExpressionResolver.resolveString(rawExpression, rawInput);
      textsToEmbed = [resolved || String(rawInput.text || JSON.stringify(rawInput))];
    }
  }

  if (textsToEmbed.length === 0 || textsToEmbed.every(t => !t.trim())) {
    return {
      status: "failed",
      error: "No valid text contents found to generate embeddings for.",
    };
  }

  ctx.logger.info(`Generating embeddings using ${provider} / ${model} for ${textsToEmbed.length} items...`);

  try {
    let embeddings: number[][] = [];
    if (provider === "openai") {
      embeddings = await getOpenAIEmbeddings(apiKey, model, textsToEmbed, ctx.signal);
    } else if (provider === "gemini") {
      embeddings = await getGeminiEmbeddings(apiKey, model, textsToEmbed, ctx.signal);
    } else {
      return { status: "failed", error: `Unsupported embeddings provider: "${provider}"` };
    }

    ctx.logger.info(`Embeddings generated successfully. Vector count: ${embeddings.length}`);

    // If input was a single item, return the single vector. Otherwise, return the list of vectors.
    if (!isArrayInput && embeddings.length === 1) {
      return {
        status: "success",
        output: {
          embedding: embeddings[0],
          model,
          provider,
        },
      };
    }

    return {
      status: "success",
      output: {
        embeddings,
        count: embeddings.length,
        model,
        provider,
      },
    };
  } catch (err: any) {
    ctx.logger.error(`Embeddings call failed: ${err.message}`);
    return { status: "failed", error: err.message };
  }
}

// ─── OpenAI Embeddings API ──────────────────────────────────────────────────
async function getOpenAIEmbeddings(
  apiKey: string,
  model: string,
  input: string[],
  signal?: AbortSignal
): Promise<number[][]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input,
    }),
    signal,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error ${response.status}: ${err?.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const results = data.data || [];
  
  // Sort by index to preserve input order
  return results
    .sort((a: any, b: any) => (a.index || 0) - (b.index || 0))
    .map((r: any) => r.embedding);
}

// ─── Gemini Embeddings API ──────────────────────────────────────────────────
async function getGeminiEmbeddings(
  apiKey: string,
  model: string,
  input: string[],
  signal?: AbortSignal
): Promise<number[][]> {
  const geminiModel = model || "text-embedding-004";
  
  // Gemini batchEmbedContents endpoint handles embedding multiple strings in one call
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:batchEmbedContents?key=${apiKey}`;
  
  const requests = input.map(text => ({
    model: `models/${geminiModel}`,
    content: { parts: [{ text }] }
  }));

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
    signal,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Gemini API error ${response.status}: ${err?.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const results = data.embeddings || [];
  return results.map((r: any) => r.values);
}
