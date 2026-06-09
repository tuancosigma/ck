import * as dns from "dns";
import { executeHttpRequest, isPrivateIP } from "./http.request";
import { NodeExecutionContext } from "@n8n-clone/workflow-core";

function makeCtx(config: Record<string, any>): NodeExecutionContext {
  return {
    nodeId: "node_http",
    nodeName: "HTTP Request",
    nodeType: "http.request",
    config,
    input: {},
    credentials: {},
    signal: new AbortController().signal,
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  } as unknown as NodeExecutionContext;
}

// ── isPrivateIP unit tests (pure function, no I/O) ───────────────────────────
describe("isPrivateIP", () => {
  it.each([
    ["127.0.0.1",     true],
    ["127.0.0.255",   true],
    ["10.0.0.1",      true],
    ["10.255.255.255",true],
    ["172.16.0.1",    true],
    ["172.31.255.255",true],
    ["192.168.1.1",   true],
    ["169.254.169.254",true], // AWS instance metadata
    ["::1",           true],
    ["fc00::1",       true],
    ["fe80::1",       true],
    ["::ffff:127.0.0.1", true], // IPv6-mapped loopback
    ["93.184.216.34", false],   // example.com
    ["8.8.8.8",       false],   // Google DNS
    ["1.1.1.1",       false],   // Cloudflare DNS
    ["172.15.0.1",    false],   // outside 172.16-31 range
    ["172.32.0.1",    false],
  ] as [string, boolean][])(
    "isPrivateIP(%s) → %s",
    (ip, expected) => {
      expect(isPrivateIP(ip)).toBe(expected);
    }
  );
});

// ── executeHttpRequest SSRF integration tests (mock DNS + fetch) ─────────────
describe("executeHttpRequest SSRF protection", () => {
  afterEach(() => jest.restoreAllMocks());

  it("blocks requests when DNS resolves to a loopback address", async () => {
    jest.spyOn(dns.promises, "lookup").mockResolvedValue([
      { address: "127.0.0.1", family: 4 },
    ] as any);

    const ctx = makeCtx({ url: "http://internal-service/admin" });
    const result = await executeHttpRequest(ctx);

    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/SSRF/i);
    expect(result.error).toContain("127.0.0.1");
  });

  it("blocks requests when DNS resolves to private class-A address", async () => {
    jest.spyOn(dns.promises, "lookup").mockResolvedValue([
      { address: "10.0.0.5", family: 4 },
    ] as any);

    const ctx = makeCtx({ url: "http://fake-internal.example.com/data" });
    const result = await executeHttpRequest(ctx);

    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/SSRF/i);
  });

  it("blocks requests to AWS metadata endpoint", async () => {
    jest.spyOn(dns.promises, "lookup").mockResolvedValue([
      { address: "169.254.169.254", family: 4 },
    ] as any);

    const ctx = makeCtx({ url: "http://169.254.169.254/latest/meta-data/" });
    const result = await executeHttpRequest(ctx);

    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/SSRF/i);
  });

  it("allows requests to public IP addresses", async () => {
    jest.spyOn(dns.promises, "lookup").mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as any);

    // Mock global fetch so we don't make real network calls
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json", entries: () => [] },
      json: async () => ({ ok: true }),
    });
    global.fetch = mockFetch as any;

    const ctx = makeCtx({ url: "https://example.com/api", method: "GET" });
    const result = await executeHttpRequest(ctx);

    expect(result.status).toBe("success");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns failed when URL is missing", async () => {
    const ctx = makeCtx({});
    const result = await executeHttpRequest(ctx);

    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/URL is required/i);
  });

  it("returns failed on DNS resolution error", async () => {
    jest.spyOn(dns.promises, "lookup").mockRejectedValue(new Error("ENOTFOUND no-such-host.invalid"));

    const ctx = makeCtx({ url: "http://no-such-host.invalid/path" });
    const result = await executeHttpRequest(ctx);

    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/DNS resolution failed/i);
  });
});
