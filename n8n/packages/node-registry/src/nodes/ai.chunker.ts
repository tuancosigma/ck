import { NodeExecutionContext, NodeExecutionResult } from "@n8n-clone/workflow-core";
import { ExpressionResolver } from "../expression-resolver";

/**
 * AI Chunker Node Executor
 * Splits a long text string into smaller chunks with custom sizes and overlaps.
 * 
 * Config:
 *   - chunkSize: number (default: 500 characters)
 *   - chunkOverlap: number (default: 50 characters)
 *   - separator: string (default: "\n")
 * 
 * Input:
 *   - Expects a text string on ctx.input or custom expression (e.g. {{$json.text}})
 */
export async function executeAiChunker(ctx: NodeExecutionContext): Promise<NodeExecutionResult> {
  ctx.logger.info("Executing AI Chunker node.");

  const resolvedConfig = ExpressionResolver.resolve(ctx.config, ctx.input);
  const chunkSize = Math.max(10, parseInt(String(resolvedConfig?.chunkSize ?? "500"), 10));
  const chunkOverlap = Math.max(0, Math.min(chunkSize - 5, parseInt(String(resolvedConfig?.chunkOverlap ?? "50"), 10)));
  const separator = String(resolvedConfig?.separator ?? "\n");

  // Determine target input text (support standard {{$json.text}} expression or plain string input)
  let rawText = "";
  if (typeof ctx.input === "string") {
    rawText = ctx.input;
  } else if (ctx.input && typeof ctx.input === "object") {
    // If input is an object, resolve standard prompt template or fall back to json string
    const rawExpression = ctx.config?.text || "{{$json.text}}";
    rawText = ExpressionResolver.resolveString(rawExpression, ctx.input);
    if (!rawText && ctx.input.text) rawText = String(ctx.input.text);
    if (!rawText) rawText = JSON.stringify(ctx.input);
  }

  if (!rawText) {
    return {
      status: "failed",
      error: "No input text provided for chunking.",
    };
  }

  ctx.logger.info(`Chunking text of length: ${rawText.length} (size: ${chunkSize}, overlap: ${chunkOverlap})`);

  const chunks: Array<{ text: string; index: number; startChar: number; endChar: number }> = [];
  const lines = rawText.split(separator);
  
  let currentChunk = "";
  let chunkStartIndex = 0;
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    let line = lines[lineIndex];

    // If a single line is larger than chunkSize, we split it by character count
    if (line.length > chunkSize) {
      if (currentChunk.trim()) {
        const start = chunkStartIndex;
        chunks.push({
          text: currentChunk.trim(),
          index: chunks.length,
          startChar: start,
          endChar: start + currentChunk.length
        });
        currentChunk = "";
      }

      let subIndex = 0;
      while (subIndex < line.length) {
        const end = Math.min(subIndex + chunkSize, line.length);
        const subLine = line.substring(subIndex, end);
        const chunkStart = chunkStartIndex + subIndex;
        chunks.push({
          text: subLine.trim(),
          index: chunks.length,
          startChar: chunkStart,
          endChar: chunkStart + subLine.length
        });
        subIndex += (chunkSize - chunkOverlap);
      }
      chunkStartIndex += line.length + separator.length;
      lineIndex++;
      continue;
    }

    // Normal line grouping
    if ((currentChunk + (currentChunk ? separator : "") + line).length <= chunkSize) {
      currentChunk += (currentChunk ? separator : "") + line;
      lineIndex++;
    } else {
      // Current chunk is full! Save it
      const start = chunkStartIndex;
      chunks.push({
        text: currentChunk.trim(),
        index: chunks.length,
        startChar: start,
        endChar: start + currentChunk.length
      });

      // Calculate sliding overlap window using last overlap characters
      const overlapText = currentChunk.substring(Math.max(0, currentChunk.length - chunkOverlap));
      const discardedLength = currentChunk.length - overlapText.length;
      currentChunk = overlapText;
      chunkStartIndex += discardedLength;
      
      // Do not increment lineIndex yet; it will be grouped in the next iteration with the overlap text prepended
    }
  }

  // Add final remaining chunk
  if (currentChunk.trim()) {
    const start = chunkStartIndex;
    chunks.push({
      text: currentChunk.trim(),
      index: chunks.length,
      startChar: start,
      endChar: start + currentChunk.length
    });
  }

  ctx.logger.info(`Chunking completed successfully. Total chunks produced: ${chunks.length}`);
  
  return {
    status: "success",
    output: {
      chunks,
      count: chunks.length,
    },
  };
}
