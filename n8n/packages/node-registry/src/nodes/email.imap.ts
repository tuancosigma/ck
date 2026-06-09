import { NodeExecutionContext, NodeExecutionResult } from "@n8n-clone/workflow-core";
import { ExpressionResolver } from "../expression-resolver";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

/**
 * IMAP Email Reader Node Executor
 * Connects securely to an email server via IMAP, fetches unread/new emails,
 * extracts key subject & body contents, and optionally flags them as read (\Seen).
 * 
 * Config:
 *   - mailbox: string (default: "INBOX")
 *   - onlyUnread: boolean (default: true)
 *   - markAsSeen: boolean (default: true)
 *   - limit: number (default: 10)
 * 
 * Credentials:
 *   - Mapped under `imap` (or falls back to `smtp` credentials mapping since host/port/user/pass are often matching)
 */
export const executeEmailImap = async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
  ctx.logger.info("Executing SMTP/IMAP email reader node.");

  const resolvedConfig = ExpressionResolver.resolve(ctx.config, ctx.input);
  const mailbox = String(resolvedConfig.mailbox || "INBOX");
  const onlyUnread = resolvedConfig.onlyUnread !== false; // default true
  const markAsSeen = resolvedConfig.markAsSeen !== false; // default true
  const limit = Math.max(1, parseInt(String(resolvedConfig.limit ?? "10"), 10));

  // Retrieve credentials from either `imap` or `smtp` mapping
  const mailCreds = ctx.credentials?.imap || ctx.credentials?.smtp;
  if (!mailCreds || !mailCreds.host || !mailCreds.user) {
    return {
      status: "failed",
      error: "IMAP node requires mapped email credentials containing 'host', 'port', 'user', and 'password'/'pass'.",
    };
  }

  // Determine port and security
  const host = String(mailCreds.host);
  const port = Number(mailCreds.port || 993);
  const user = String(mailCreds.user);
  const password = String(mailCreds.password || mailCreds.pass || "");
  const secure = mailCreds.secure === true || mailCreds.secure === "true" || port === 993;

  ctx.logger.info(`Connecting to IMAP host: ${host}:${port} (secure: ${secure}) for user: ${user}...`);

  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: {
      user,
      pass: password,
    },
    connectionTimeout: 15000, // Fail fast if blocked by firewall/network
    logger: false, // Suppress internal verbose logger
  });

  // Prevent unhandled 'error' events from crashing the entire worker process
  client.on("error", (err) => {
    ctx.logger.error(`IMAP background connection error: ${err.message}`);
  });

  try {
    await client.connect();
    ctx.logger.info(`Successfully connected! Accessing mailbox: "${mailbox}"...`);

    // Obtain a mailbox lock to perform search and fetch operations
    const lock = await client.getMailboxLock(mailbox);
    const messages: any[] = [];

    try {
      const searchCriteria = onlyUnread ? { unseen: true } : { all: true };
      ctx.logger.info(`Searching for messages with criteria: ${JSON.stringify(searchCriteria)}...`);
      const uids = await client.search(searchCriteria);
      const uidList = Array.isArray(uids) ? uids : [];
      ctx.logger.info(`Search found ${uidList.length} message UIDs.`);

      if (uidList.length > 0) {
        const uidsToFetch = uidList.slice(0, limit);
        const fetchGenerator = client.fetch(uidsToFetch, { source: true, envelope: true });
        const fetchedUids: number[] = [];
        
        for await (const msg of fetchGenerator) {
          if (messages.length >= limit) {
            ctx.logger.info(`Reached limit of ${limit} messages. Stopping fetch.`);
            break;
          }

          ctx.logger.info(`Parsing message UID ${msg.uid} (Seq: ${msg.seq})...`);

          if (!msg.source) {
            ctx.logger.info(`Message UID ${msg.uid} has empty source. Skipping.`);
            continue;
          }

          // Parse full email body source using mailparser
          const parsed = (await simpleParser(msg.source)) as any;
          const plainText = parsed.text ? parsed.text.substring(0, 1200).trim() : "";

          messages.push({
            id: msg.uid,
            seq: msg.seq,
            from: parsed.from?.text || msg.envelope?.from?.map((f: any) => `${f.name || ""} <${f.address}>`).join(", ") || "",
            subject: parsed.subject || msg.envelope?.subject || "(No Subject)",
            date: parsed.date || msg.envelope?.date || new Date(),
            text: plainText,
          });

          if (markAsSeen) {
            fetchedUids.push(msg.uid);
          }
        }

        // Batch flag emails as Seen in a single request outside the loop
        if (markAsSeen && fetchedUids.length > 0) {
          ctx.logger.info(`Flagging ${fetchedUids.length} messages as \\Seen in batch...`);
          await client.messageFlagsAdd(fetchedUids, ["\\Seen"], { uid: true });
        }
      }
    } finally {
      // Always release the lock
      lock.release();
    }

    ctx.logger.info(`Finished fetching emails successfully. Count: ${messages.length}`);
    return {
      status: "success",
      output: {
        emails: messages,
        count: messages.length,
      },
    };

  } catch (err: any) {
    const detail = err.command ? ` (Command: ${err.command}, Response: ${err.response?.status} - ${err.response?.text || JSON.stringify(err.response)})` : "";
    ctx.logger.error(`IMAP connection or parsing failed: ${err.message}${detail}`);
    if (err.stack) {
      ctx.logger.error(`Stack trace: ${err.stack}`);
    }
    return {
      status: "failed",
      error: `${err.message}${detail}`,
    };
  } finally {
    // Log out cleanly from the mail server
    await client.logout().catch(() => {});
  }
};
