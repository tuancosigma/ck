import { NodeExecutionContext, NodeExecutionResult } from "@n8n-clone/workflow-core";
import { ExpressionResolver } from "../expression-resolver";
import { Client } from "pg";

export const executePostgresQuery = async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
  ctx.logger.info("Executing Postgres Database node.");

  const resolvedConfig = ExpressionResolver.resolve(ctx.config, ctx.input);
  const { query, values } = resolvedConfig;

  if (!query) {
    return {
      status: "failed",
      error: "SQL query string is required.",
    };
  }

  // Get and resolve credentials
  const dbCreds = ctx.credentials?.postgres;
  if (!dbCreds || !dbCreds.host || !dbCreds.database) {
    return {
      status: "failed",
      error: "Postgres node requires mapped credentials (host, port, user, password, database).",
    };
  }

  // Apply connection + query timeouts to prevent worker starvation when the target
  // DB is unreachable or a query runs indefinitely.
  const queryTimeoutMs = Number(ctx.config.timeoutMs) || 60000;

  const client = new Client({
    host: String(dbCreds.host),
    port: Number(dbCreds.port) || 5432,
    database: String(dbCreds.database),
    user: String(dbCreds.user),
    password: String(dbCreds.password || ""),
    ssl: dbCreds.ssl === true || dbCreds.ssl === "true" ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 10000, // fail fast if DB is unreachable (default is infinite)
    query_timeout: queryTimeoutMs,  // per-query wall clock limit
  });

  try {
    ctx.logger.info(`Connecting to Postgres database at ${dbCreds.host}:${dbCreds.port || 5432}/${dbCreds.database}...`);
    await client.connect();

    const paramValues = Array.isArray(values) ? values : [];
    ctx.logger.info(`Running SQL statement: "${query.substring(0, 100)}${query.length > 100 ? "..." : ""}"`);
    
    const res = await client.query(query, paramValues);

    ctx.logger.info(`Query completed successfully. Row count: ${res.rowCount}`);
    return {
      status: "success",
      output: {
        rows: res.rows,
        rowCount: res.rowCount,
        command: res.command,
      },
    };
  } catch (err: any) {
    ctx.logger.error(`Database query failed: ${err.message}`);
    return {
      status: "failed",
      error: err.message || err,
    };
  } finally {
    // Make sure we always disconnect cleanly!
    await client.end().catch((e) => ctx.logger.error(`Error closing connection: ${e.message}`));
  }
};
