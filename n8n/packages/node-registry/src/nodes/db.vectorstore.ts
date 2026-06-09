import { NodeExecutionContext, NodeExecutionResult } from "@n8n-clone/workflow-core";
import { ExpressionResolver } from "../expression-resolver";
import { Client } from "pg";

/**
 * PGVector Store Node Executor
 * Manages database vectors, supporting document chunk upserting and semantic similarity queries.
 * Automatically handles PGVector extension creation and table initialization.
 * 
 * Config:
 *   - action: "upsert" | "query"  (default: upsert)
 *   - tableName: string           (default: vector_store_documents)
 *   - limit: number               (default: 5, for query mode)
 *   - chunks: expression          (optional expression to fetch chunks list)
 *   - embeddings: expression      (optional expression to fetch embeddings list)
 * 
 * Input:
 *   - upsert mode: expects matched [{ text: "...", embedding: [...] }]
 *   - query mode: expects a target embedding vector [0.12, -0.04, ...]
 */
export const executeVectorStore = async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
  ctx.logger.info("Executing PGVector Store node.");

  const resolvedConfig = ExpressionResolver.resolve(ctx.config, ctx.input);
  const action = resolvedConfig?.action || "upsert";
  const rawTableName = String(resolvedConfig?.tableName || "vector_store_documents").trim();
  const limit = Math.max(1, parseInt(String(resolvedConfig?.limit ?? "5"), 10));

  // Sanitize table name to prevent SQL injection (alphanumeric and underscores only)
  const tableName = rawTableName.replace(/[^a-zA-Z0-9_]/g, "");
  if (!tableName) {
    return { status: "failed", error: "Invalid vector table name specified." };
  }

  // Get and resolve credentials
  const dbCreds = ctx.credentials?.postgres;
  if (!dbCreds || !dbCreds.host || !dbCreds.database) {
    return {
      status: "failed",
      error: "Postgres vector node requires mapped database credentials (host, port, user, password, database).",
    };
  }

  const client = new Client({
    host: String(dbCreds.host),
    port: Number(dbCreds.port) || 5432,
    database: String(dbCreds.database),
    user: String(dbCreds.user),
    password: String(dbCreds.password || ""),
    ssl: dbCreds.ssl === true || dbCreds.ssl === "true" ? { rejectUnauthorized: false } : undefined,
  });

  try {
    ctx.logger.info(`Connecting to PostgreSQL at ${dbCreds.host}:${dbCreds.port || 5432}/${dbCreds.database}...`);
    await client.connect();

    // 1. Ensure pgvector and pgcrypto extensions are enabled
    ctx.logger.info("Ensuring 'vector' and 'pgcrypto' extensions are enabled in PostgreSQL...");
    await client.query("CREATE EXTENSION IF NOT EXISTS vector;");
    await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");

    if (action === "upsert") {
      // 2. Parse paired chunk + embedding inputs
      let itemsToUpsert: Array<{ text: string; embedding: number[] }> = [];

      // Support zipped inputs from config mapping expressions
      const resolvedChunks = resolvedConfig?.chunks;
      const resolvedEmbeddings = resolvedConfig?.embeddings;

      if (Array.isArray(resolvedChunks) && Array.isArray(resolvedEmbeddings)) {
        // Zip chunks and embeddings arrays together
        const minLen = Math.min(resolvedChunks.length, resolvedEmbeddings.length);
        for (let i = 0; i < minLen; i++) {
          const c = resolvedChunks[i];
          const text = typeof c === "string" ? c : String(c?.text || c?.content || JSON.stringify(c));
          const embedding = Array.isArray(resolvedEmbeddings[i]) ? resolvedEmbeddings[i] : null;
          if (text && embedding) {
            itemsToUpsert.push({ text, embedding });
          }
        }
      } else {
        // Check ctx.input directly (or nested under input.chunks / input.embeddings)
        const rawInput = ctx.input;
        if (Array.isArray(rawInput)) {
          itemsToUpsert = rawInput.filter(item => item && typeof item === "object" && item.text && Array.isArray(item.embedding));
        } else if (rawInput && typeof rawInput === "object") {
          // If chunker and embeddings outputs were somehow nested
          const chunksList = Array.isArray(rawInput.chunks) ? rawInput.chunks : [];
          const embeddingsList = Array.isArray(rawInput.embeddings) ? rawInput.embeddings : [];
          
          if (chunksList.length > 0 && embeddingsList.length > 0) {
            const minLen = Math.min(chunksList.length, embeddingsList.length);
            for (let i = 0; i < minLen; i++) {
              const c = chunksList[i];
              const text = typeof c === "string" ? c : String(c?.text || JSON.stringify(c));
              const embedding = embeddingsList[i];
              if (text && Array.isArray(embedding)) {
                itemsToUpsert.push({ text, embedding });
              }
            }
          } else if (rawInput.text && Array.isArray(rawInput.embedding)) {
            itemsToUpsert = [{ text: String(rawInput.text), embedding: rawInput.embedding }];
          }
        }
      }

      if (itemsToUpsert.length === 0) {
        return {
          status: "failed",
          error: "No paired text chunks and embedding vectors found in the input to upsert. Please ensure you are passing matching Chunker and Embeddings arrays.",
        };
      }

      const vectorDimension = itemsToUpsert[0].embedding.length;
      ctx.logger.info(`Parsed ${itemsToUpsert.length} items to insert. Vector dimension detected: ${vectorDimension}`);

      // 3. Ensure target documents table exists with correct vector size
      ctx.logger.info(`Ensuring vector store table "${tableName}" exists with size ${vectorDimension}...`);
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          text TEXT NOT NULL,
          embedding vector(${vectorDimension}) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // 4. Batch insert document vectors
      ctx.logger.info(`Inserting ${itemsToUpsert.length} records into "${tableName}"...`);
      for (const item of itemsToUpsert) {
        // Formats numbers vector array into PostgreSQL vector format string e.g. '[0.12, -0.04, 0.99]'
        const vectorStr = `[${item.embedding.join(",")}]`;
        await client.query(
          `INSERT INTO ${tableName} (text, embedding) VALUES ($1, $2::vector);`,
          [item.text, vectorStr]
        );
      }

      ctx.logger.info("Upsert completed successfully.");
      return {
        status: "success",
        output: {
          insertedCount: itemsToUpsert.length,
          tableName,
        },
      };

    } else if (action === "query") {
      // 2. Parse target query embedding vector
      let queryVector: number[] | null = null;
      const resolvedEmbeddings = resolvedConfig?.embeddings;

      if (Array.isArray(resolvedEmbeddings)) {
        queryVector = resolvedEmbeddings;
      } else if (Array.isArray(ctx.input)) {
        queryVector = ctx.input;
      } else if (ctx.input && typeof ctx.input === "object" && Array.isArray(ctx.input.embedding)) {
        queryVector = ctx.input.embedding;
      } else if (ctx.input && typeof ctx.input === "object" && Array.isArray(ctx.input.embeddings)) {
        queryVector = ctx.input.embeddings[0]; // first if list
      }

      if (!queryVector || queryVector.length === 0) {
        return {
          status: "failed",
          error: "Query mode requires a valid target embedding vector input array (e.g. [0.1, -0.2, ...]).",
        };
      }

      ctx.logger.info(`Performing semantic similarity search (cosine distance) inside "${tableName}"...`);

      // 3. Execute cosine distance similarity search query: <=> operator returns cosine distance
      const vectorStr = `[${queryVector.join(",")}]`;
      
      // Query table existence first to prevent crash
      const tableCheck = await client.query(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1);",
        [tableName]
      );
      if (!tableCheck.rows[0].exists) {
        return {
          status: "success",
          output: {
            documents: [],
            count: 0,
            message: `Vector store table "${tableName}" does not exist yet. Run in upsert mode first to register documents.`,
          },
        };
      }

      const res = await client.query(`
        SELECT id, text, (embedding <=> $1::vector) AS distance 
        FROM ${tableName} 
        ORDER BY distance ASC 
        LIMIT $2;
      `, [vectorStr, limit]);

      // Map to return clean matching document outputs
      const documents = res.rows.map(row => ({
        id: row.id,
        text: row.text,
        similarity: parseFloat((1 - row.distance).toFixed(4)), // Cosine similarity = 1 - Cosine distance
      }));

      ctx.logger.info(`Search completed. Top matches found: ${documents.length}`);
      return {
        status: "success",
        output: {
          documents,
          count: documents.length,
          tableName,
        },
      };

    } else {
      return { status: "failed", error: `Unsupported Vector Store action: "${action}"` };
    }

  } catch (err: any) {
    ctx.logger.error(`PGVector operation failed: ${err.message}`);
    return { status: "failed", error: err.message || err };
  } finally {
    await client.end().catch((e) => ctx.logger.error(`Error closing connection: ${e.message}`));
  }
};
