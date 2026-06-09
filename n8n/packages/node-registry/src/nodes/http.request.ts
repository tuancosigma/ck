import { NodeExecutionContext, NodeExecutionResult } from "@n8n-clone/workflow-core";
import { ExpressionResolver } from "../expression-resolver";
import * as dns from "dns";

/**
 * Checks if an IP address resides in a private, loopback, or cloud-metadata network.
 */
export function isPrivateIP(ip: string): boolean {
  // Normalize IPv6 mapped IPv4 addresses (e.g. ::ffff:127.0.0.1)
  let normalizedIp = ip;
  if (ip.startsWith("::ffff:")) {
    normalizedIp = ip.substring(7);
  }

  // IPv6 private ranges
  if (normalizedIp === "::1" || normalizedIp === "0:0:0:0:0:0:0:1") return true;
  if (normalizedIp.toLowerCase().startsWith("fc00:") || normalizedIp.toLowerCase().startsWith("fe80:")) return true;

  // IPv4 format check
  const parts = normalizedIp.split(".").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false;

  const [a, b] = parts;
  if (a === 127) return true; // Loopback
  if (a === 10) return true; // Private class A
  if (a === 172 && b >= 16 && b <= 31) return true; // Private class B
  if (a === 192 && b === 168) return true; // Private class C
  if (a === 169 && b === 254) return true; // Link-local / Cloud metadata IP
  if (a === 0) return true; // Loopback broadcast address

  return false;
}

export const executeHttpRequest = async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
  const resolvedConfig = ExpressionResolver.resolve(ctx.config, ctx.input);
  const { url, method = "GET", headers = {}, body } = resolvedConfig;

  if (!url) {
    return {
      status: "failed",
      error: "URL is required for HTTP Request node.",
    };
  }

  try {
    const urlObj = new URL(url);  
    const hostname = urlObj.hostname;

    ctx.logger.info(`HTTP Request Node: Resolving hostname "${hostname}" to check for SSRF risk...`);

    // 1. Resolve hostnames to IPs and validate
    // If it's already an IP address, this resolves immediately.
    let resolvedAddresses: dns.LookupAddress[] = [];
    try {
      resolvedAddresses = await dns.promises.lookup(hostname, { all: true });
    } catch (dnsErr: any) {
      ctx.logger.error(`DNS Resolution failed for ${hostname}: ${dnsErr.message}`);
      return {
        status: "failed",
        error: `DNS resolution failed: ${dnsErr.message}`,
      };
    }

    for (const { address } of resolvedAddresses) {
      if (isPrivateIP(address)) {
        ctx.logger.error(`SSRF Protection triggered! Private address resolved: ${address}`);
        return {
          status: "failed",
          error: `SSRF Prevention: Access to private, local, or cloud metadata network is blocked. Resolved: ${address}`,
        };
      }
    }

    // 2. Perform the fetch call
    ctx.logger.info(`SSRF validation passed. Sending ${method} to ${url}...`);

    const requestHeaders: Record<string, string> = {};
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        requestHeaders[String(k)] = String(v);
      }
    }

    let requestBody: string | undefined;
    if (body) {
      requestBody = typeof body === "object" ? JSON.stringify(body) : String(body);
      if (!requestHeaders["Content-Type"]) {
        requestHeaders["Content-Type"] = "application/json";
      }
    }

    // Per-request timeout: prevents indefinite hang when remote server stalls.
    // Combined with ctx.signal so manual execution cancellation also aborts.
    const timeoutMs = Number(resolvedConfig.timeoutMs) || 30000;
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
    if (ctx.signal) {
      ctx.signal.addEventListener("abort", () => timeoutController.abort(), { once: true });
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: requestBody,
        signal: timeoutController.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      const isTimeout = timeoutController.signal.aborted && !ctx.signal?.aborted;
      throw isTimeout
        ? new Error(`HTTP request timed out after ${timeoutMs}ms (no response from ${url})`)
        : fetchErr;
    }
    clearTimeout(timeoutId);

    const contentType = response.headers.get("content-type") || "";
    let data: any;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      return {
        status: "failed",
        error: `HTTP Error ${response.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`,
      };
    }

    return {
      status: "success",
      output: {
        statusCode: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        data,
      },
    };
  } catch (err: any) {
    ctx.logger.error(`HTTP Request failed: ${err.message}`);
    return {
      status: "failed",
      error: err.message || err,
    };
  }
};
