import { executeManualTrigger } from "./nodes/manual.trigger";
import { executeCronTrigger } from "./nodes/cron.trigger";
import { executeWebhookTrigger } from "./nodes/webhook.trigger";
import { executeHttpRequest } from "./nodes/http.request";
import { executeLogicIf } from "./nodes/logic.if";
import { executeCodeJavascript } from "./nodes/code.javascript";
import { executeDelay } from "./nodes/delay";
import { executeEmailSmtp } from "./nodes/email.smtp";
import { executeEmailImap } from "./nodes/email.imap";
import { executePostgresQuery } from "./nodes/db.postgres.query";
import { executeSystemCommand } from "./nodes/execute.command";
import { executeAiAgent } from "./nodes/ai.agent";
import { executeAiChunker } from "./nodes/ai.chunker";
import { executeAiEmbeddings } from "./nodes/ai.embeddings";
import { executeVectorStore } from "./nodes/db.vectorstore";

export * from "./expression-resolver";
export * from "./nodes/manual.trigger";
export * from "./nodes/cron.trigger";
export * from "./nodes/webhook.trigger";
export * from "./nodes/http.request";
export * from "./nodes/logic.if";
export * from "./nodes/code.javascript";
export * from "./nodes/delay";
export * from "./nodes/email.smtp";
export * from "./nodes/email.imap";
export * from "./nodes/db.postgres.query";
export * from "./nodes/execute.command";
export * from "./nodes/ai.agent";
export * from "./nodes/ai.chunker";
export * from "./nodes/ai.embeddings";
export * from "./nodes/db.vectorstore";

/**
 * Global Node Registry mapping all standard node type strings
 * to their respective executable runner functions.
 */
export const NODE_EXECUTOR_REGISTRY: Record<string, any> = {
  "manual.trigger": executeManualTrigger,
  "cron.trigger": executeCronTrigger,
  "webhook.trigger": executeWebhookTrigger,
  "http.request": executeHttpRequest,
  "logic.if": executeLogicIf,
  "code.javascript": executeCodeJavascript,
  "delay": executeDelay,
  "email.smtp": executeEmailSmtp,
  "email.imap": executeEmailImap,
  "db.postgres.query": executePostgresQuery,
  "execute.command": executeSystemCommand,
  "ai.agent": executeAiAgent,
  "ai.chunker": executeAiChunker,
  "ai.embeddings": executeAiEmbeddings,
  "db.vectorstore": executeVectorStore,
};
