# Security Specification - Workflow Automation Platform

This document outlines the core security implementations, SSRF mitigations, database credentials vault encryption, and execution sandboxing controls built into the platform.

---

## 1. Credentials Vault (AES-256-GCM Hashing)

Plaintext credentials (SMTP passwords, PostgreSQL tokens) are **never** persisted to our database, nor are they ever returned to the client dashboard via standard REST requests.

*   **Encryption Standard**: Symmetric Authenticated Encryption using **AES-256-GCM** (Galois/Counter Mode). GCM provides both data confidentiality and authenticity verification via an authentication tag.
*   **Key Derivation**: The `MASTER_KEY` environment variable is loaded. If it's a string, we pass it through a SHA-256 hash to enforce a mathematically correct 32-byte (256-bit) cryptographic key.
*   **Tamper Protection**: We generate a unique random 12-byte Initialization Vector (IV) per record. The encryption yields the ciphertext, the IV, and the GCM authentication tag. Decryption verifies the tag first; if the record is tampered with offline, the decryption throws an immediate exception and aborts execution.

---

## 2. SSRF Protection (HTTP Request Node)

Server-Side Request Forgery (SSRF) represents a high risk in automation builders since users can prompt the server to make custom HTTP requests. Our HTTP Request node implements DNS-level filtering:

1.  **DNS Resolve Interception**: Before triggering any HTTP requests, we extract the hostname using `new URL(url).hostname` and run a DNS look-up: `dns.promises.lookup(hostname, { all: true })`.
2.  **IP Address Validation**: We resolve all IPs associated with the hostname and verify them against loopback, private networks, and link-local ranges:
    *   `127.0.0.0/8` (Loopback/Localhost)
    *   `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (Private CIDRs)
    *   `169.254.169.254` (AWS, GCP, Azure Cloud instance metadata service)
    *   `::1`, `fc00::/7`, `fe80::/10` (IPv6 Loopback and Unique/Link Local ranges)
3.  **Aborting Request**: If a resolved IP address falls into these ranges, the request is immediately blocked, logging an SSRF Prevention trigger in the execution step logs.
4.  **Rebinding Protection**: Resolving the address before launching the fetch client mitigates DNS Rebinding attacks by enforcing IP validation at the exact time of connection.

---

## 3. Restricted Javascript Execution Sandbox (`vm` Module)

Custom JavaScript code must be isolated from the parent worker system to prevent host process compromise or file access.

*   **Context Isolation**: We utilize Node's built-in `vm.createContext()` and `vm.Script.runInContext()` API.
*   **Stripped Globals**: We construct a pristine sandbox context containing only safe, required objects (`$input`, `$json`, `console.log`, `setTimeout`, `Buffer`, `URL`). We strip core system variables: `process` (killing parent process), `require` / `module` (importing native fs/net drivers), `global`, and standard environment hooks.
*   **Execution Timeouts**: Synchronous infinite loops (`while(true){}`) can freeze CPU execution threads. We pass a strict `timeout` parameter (default 5000ms) to `runInContext`. If CPU execution time is exceeded, the VM script naturally throws a timeout exception, halting the worker task gracefully.

---

## 4. Log Secret-Masking

Plaintext tokens, API keys, or passwords must never appear in visual execution trace logs.
*   When our worker intercepts a node's execution completed or failed event, it passes the node's `input` and `output` objects through a recursive log secret-masking filter.
*   The filter recursively scans object keys and array elements.
*   If a key name contains standard credentials keywords (e.g. `password`, `secret`, `token`, `key`, `pass`, `authorization`, `auth`, `apikey`), the plaintext value is automatically overwritten with `****** [MASKED SECRET] ******` before being written to PostgreSQL.
