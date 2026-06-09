import { NodeExecutionContext, NodeExecutionResult } from "@n8n-clone/workflow-core";
import { ExpressionResolver } from "../expression-resolver";
import * as nodemailer from "nodemailer";

export const executeEmailSmtp = async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
  ctx.logger.info("Executing SMTP email node.");

  const resolvedConfig = ExpressionResolver.resolve(ctx.config, ctx.input);
  const { from, to, subject, html, text } = resolvedConfig;

  if (!to || !subject) {
    return {
      status: "failed",
      error: "Missing required fields: 'to' and 'subject' are mandatory.",
    };
  }

  // Get and resolve credentials
  const smtpCreds = ctx.credentials?.smtp;
  if (!smtpCreds || !smtpCreds.host || !smtpCreds.port) {
    return {
      status: "failed",
      error: "SMTP node requires mapped SMTP credentials (host, port, user, pass).",
    };
  }

  try {
    ctx.logger.info(`Connecting to SMTP host: ${smtpCreds.host}:${smtpCreds.port}...`);

    // Apply transport-level timeouts to prevent worker starvation when the SMTP
    // server is unreachable or the greeting handshake hangs.
    const transporter = nodemailer.createTransport({
      host: String(smtpCreds.host),
      port: Number(smtpCreds.port),
      secure: smtpCreds.secure === true || smtpCreds.secure === "true",
      auth: smtpCreds.user ? {
        user: String(smtpCreds.user),
        pass: String(smtpCreds.pass || ""),
      } : undefined,
      connectionTimeout: 15000, // TCP connect timeout
      greetingTimeout: 10000,   // EHLO/HELO greeting timeout after connect
      socketTimeout: 30000,     // idle socket timeout during DATA transfer
    });

    const mailOptions = {
      from: from || smtpCreds.user || "no-reply@n8n-clone.local",
      to,
      subject,
      text,
      html,
    };

    ctx.logger.info(`Sending mail to "${to}"...`);
    const info = await transporter.sendMail(mailOptions);

    ctx.logger.info(`Mail sent successfully! MessageId: ${info.messageId}`);
    return {
      status: "success",
      output: {
        messageId: info.messageId,
        response: info.response,
        to,
      },
    };
  } catch (err: any) {
    ctx.logger.error(`SMTP transmission failed: ${err.message}`);
    return {
      status: "failed",
      error: err.message || err,
    };
  }
};
