# System Architecture

## High-Level Overview

n8n Clone is a monorepo-based workflow automation platform composed of:

1. **API Backend** (NestJS) — REST API, job queue, credential vault, execution engine
2. **Frontend** (Next.js 14) — Visual workflow editor, execution tracer, credential management UI
3. **Shared Libraries** — TypeScript types, workflow DAG validator, 40+ prebuilt node implementations
4. **Data Layer** (PostgreSQL + Redis) — Persistent state, job queue backing, audit logs
5. **Worker Pool** (BullMQ) — Distributed execution engine with retry/dead-letter logic

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js 14)                    │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ Workflow Editor│  │ Exec Tracer  │  │ Credential Manager │  │
│  │ (React)        │  │ (SSE Stream) │  │ (Vault UI)         │  │
│  └────────────────┘  └──────────────┘  └────────────────────┘  │
└──────────────┬─────────────────────────────────────────────────┘
               │ REST API + JWT Auth + SSE EventSource
┌──────────────▼─────────────────────────────────────────────────┐
│                    API Backend (NestJS 10)                      │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────┐   │
│  │ Workflows    │  │ Executions     │  │ Webhooks         │   │
│  │ Controller   │  │ Controller     │  │ Controller       │   │
│  │ (CRUD,       │  │ (History,      │  │ (Dynamic Routes) │   │
│  │ Activate)    │  │ Stream)        │  │                  │   │
│  └──────────────┘  └────────────────┘  └──────────────────┘   │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────┐   │
│  │ Credentials  │  │ Scheduler      │  │ Queue Service    │   │
│  │ Service      │  │ Service        │  │ (BullMQ Wrapper) │   │
│  │ (Vault,      │  │ (Cron          │  │                  │   │
│  │ Encryption)  │  │ Registration)  │  │                  │   │
│  └──────────────┘  └────────────────┘  └──────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Prisma ORM Layer                      │  │
│  │         (Type-safe DB queries, migrations)               │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────┬──────────────┬──────────────┬──────────────────┘
               │              │              │
        ┌──────▼──┐   ┌──────▼──┐  ┌──────▼──┐
        │PostgreSQL│   │ Redis   │  │Workflow │
        │ (State)  │   │ (Queue) │  │ Core    │
        └──────────┘   └─────────┘  └─────────┘
               │              │              │
        ┌──────▼──────────────▼──────────────▼──────────┐
        │          BullMQ Worker Pool (Node.js)        │
        │  ┌──────────────┐  ┌──────────────────────┐  │
        │  │ Job Processor│  │ Execution Engine    │  │
        │  │ (Dequeue)    │  │ (Node Execution,    │  │
        │  │              │  │  Status Emission)   │  │
        │  └──────────────┘  └──────────────────────┘  │
        │                                               │
        │    Node Registry (40+ Prebuilt Nodes)       │
        │  - execute.command                           │
        │  - http.request                              │
        │  - code.javascript                           │
        │  - db.postgres.query                         │
        │  - email.smtp                                │
        │  - logic.if.branching                        │
        │  - ... (38 more)                             │
        └─────────────────────────────────────────────┘
```

---

## Core Components

### 1. API Backend (NestJS 10.3)

#### Module Architecture
```
app.module.ts
├── AuthModule
│   ├── AuthService (JWT generation, validation)
│   ├── AuthController (POST /auth/login, POST /auth/register)
│   └── JwtStrategy (Passport strategy)
├── WorkflowsModule
│   ├── WorkflowsService (CRUD, versioning, activation)
│   ├── WorkflowsController (REST endpoints)
│   └── SchedulerService (Cron registration)
├── ExecutionsModule
│   ├── ExecutionsService (History queries, SSE preparation)
│   ├── ExecutionsController (GET /executions, GET /executions/:id/stream)
│   └── (SSE EventSource management)
├── CredentialsModule
│   ├── CredentialsService (Encryption/decryption, vault isolation)
│   ├── CredentialsController (CRUD)
│   └── EncryptionUtil (AES-256-GCM with fresh IV)
├── WebhooksModule
│   ├── WebhooksService (Dynamic route registration)
│   ├── WebhooksController (Webhook handlers)
│   └── (Signature verification, sync/async modes)
├── QueueModule
│   ├── QueueService (BullMQ wrapper)
│   └── WorkerProcessor (Job handler, node execution)
├── SchedulerModule
│   └── SchedulerService (Cron repeat registration/deregistration)
├── WorkspaceModule
│   ├── WorkspaceService (Multi-tenancy, isolation)
│   └── WorkspaceController (Workspace CRUD)
└── PrismaModule
    └── PrismaService (DB client, migrations)
```

#### Request Flow (Example: Manual Workflow Execution)

```
POST /executions (start manual workflow)
    │
    ├─> AuthGuard::jwt (verify token, extract workspaceId)
    │
    ├─> ExecutionsController::create()
    │       │
    │       ├─> PrismaService.execution.create({status: QUEUED})
    │       │
    │       └─> QueueService.addJob(
    │               jobName: `exec:{workflowId}:{executionId}`,
    │               data: {executionId, workflowId, ...},
    │               options: {attempts: 3, backoff: exponential}
    │           )
    │
    └─> Response: {executionId, status: QUEUED}
            │
            └─> [Background] BullMQ dequeues job
                    │
                    ├─> WorkerProcessor.process()
                    │       │
                    │       ├─> Fetch Workflow + Credentials
                    │       ├─> Validate graph via GraphValidator
                    │       ├─> Execute nodes in topological order
                    │       │
                    │       └─> For each node:
                    │           ├─> Create ExecutionStep {status: RUNNING, startedAt}
                    │           ├─> Instantiate node class + execute()
                    │           ├─> Update ExecutionStep {status: SUCCESS, output, durationMs}
                    │           ├─> [SSE] Emit node_completed event → Frontend
                    │           └─> Continue to dependent nodes
                    │
                    └─> Update Execution {status: SUCCESS, finishedAt}
```

### 2. Workflow Execution Pipeline

#### Graph Validation & Traversal
```typescript
// Input: WorkflowGraph
{
  version: "1.0",
  nodes: [
    { id: "n1", type: "manual.trigger", config: {} },
    { id: "n2", type: "http.request", config: {url: "https://..."} },
    { id: "n3", type: "logic.if", config: {condition: "status === 200"} },
    { id: "n4", type: "email.smtp", config: {to: "admin@..."} },
  ],
  edges: [
    { source: "n1", target: "n2" },
    { source: "n2", target: "n3" },
    { source: "n3", target: "n4", label: "true" },
  ]
}

// Validation (GraphValidator)
1. Check DAG (no cycles)
2. Verify node types exist in registry
3. Validate config against node schema (Zod)
4. Check edge source/target node IDs exist

// Execution (topological sort)
1. n1 (trigger) — no dependencies, executes immediately
2. n2 (http.request) — depends on n1, waits for output
3. n3 (logic.if) — depends on n2, routes based on condition
4. n4 (email.smtp) — conditional, executes only on true path
```

#### Timeout & Reliability Guarantees
```typescript
// Per-node timeout enforcement (WorkerProcessor)

async function executeNode(node, inputs, workspace) {
  const timeoutMs = node.config.timeout || 30000;
  
  // Promise.race ensures timeout even for non-responsive async code
  const result = await Promise.race([
    nodeInstance.execute(inputs),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Node timeout')), timeoutMs)
    )
  ]);
  
  return result;
}

// OS-level timeout for execute.command
execSync('command', {
  timeout: 30000,           // Kill process after 30s
  killSignal: 'SIGTERM',    // Or SIGKILL on Windows
  stdio: 'pipe'             // Capture output
})
```

### 3. Credential Vault (Encryption Architecture)

#### AES-256-GCM Encryption Flow

```
┌──────────────────────────────────────────────────────┐
│           Credential Encryption (Write Path)         │
├──────────────────────────────────────────────────────┤
│                                                      │
│  1. User submits credential form (password/API key) │
│     POST /credentials {type, data}                  │
│                                                      │
│  2. EncryptionUtil.encrypt(data)                   │
│     ├─> Generate random IV (16 bytes)              │
│     ├─> Derive key from ENCRYPTION_KEY             │
│     ├─> createCipheriv('aes-256-gcm', key, IV)    │
│     ├─> Encrypt JSON.stringify(data)               │
│     ├─> Generate authentication tag (16 bytes)     │
│     └─> Return {encryptedData, iv, tag}            │
│                                                      │
│  3. PrismaService.credential.create({              │
│       ...credential,                               │
│       encryptedData: Buffer.toString('base64'),    │
│       iv: Buffer.toString('base64'),               │
│       tag: Buffer.toString('base64')               │
│     })                                              │
│                                                      │
│  4. Database stores Base64-encoded ciphertext      │
│     (plaintext never touches disk)                 │
│                                                      │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│          Credential Decryption (Read Path)           │
├──────────────────────────────────────────────────────┤
│                                                      │
│  1. WorkerProcessor needs credential for node      │
│     credId = node.config.credentialId              │
│                                                      │
│  2. PrismaService.credential.findUnique({          │
│       where: {id: credId},                         │
│       select: {encryptedData, iv, tag, workspaceId}│
│     })                                              │
│                                                      │
│  3. Verify workspaceId matches execution context   │
│     (C1 security fix)                              │
│                                                      │
│  4. EncryptionUtil.decrypt(encrypted, iv, tag)    │
│     ├─> Convert Base64 to Buffer                   │
│     ├─> createDecipheriv('aes-256-gcm', key, iv)  │
│     ├─> Decipher ciphertext                        │
│     ├─> Verify authentication tag (prevents        │
│     │   tampering)                                 │
│     └─> JSON.parse(plaintext)                      │
│                                                      │
│  5. Plaintext credential only exists in memory     │
│     (never logged, not cached)                     │
│                                                      │
└──────────────────────────────────────────────────────┘

Key Invariant: Every write uses a FRESH IV
- Old IV: never reused (prevents known-plaintext attacks)
- New IV: cryptographically random via crypto.randomBytes()
- Result: Identical plaintext encrypts to different ciphertext
```

#### Isolation & Access Control
```typescript
// All credential queries include workspaceId filter (C1 fix)

async getCredential(credId: string, workspaceId: string) {
  const cred = await this.prisma.credential.findUnique({
    where: { id: credId },
  });

  // Verify ownership
  if (cred.workspaceId !== workspaceId) {
    throw new ForbiddenException('Credential does not belong to your workspace');
  }

  return decrypt(cred);
}

// PATCH /credentials/:id — never pre-fills sensitive fields
async update(credId: string, workspaceId: string, data: Partial<CredData>) {
  const existing = await this.getCredential(credId, workspaceId);
  
  // Only re-encrypt if data fields changed (not password)
  const shouldReencrypt = data.data !== undefined;
  
  if (shouldReencrypt) {
    // Generate new IV + tag
    const {encryptedData, iv, tag} = encrypt(data.data);
    
    await this.prisma.credential.update({
      where: { id: credId },
      data: { encryptedData, iv, tag, updatedAt: new Date() }
    });
  }
}

// Frontend form never includes plaintext
return {
  id: cred.id,
  name: cred.name,
  type: cred.type,
  // password: undefined,     ← Never returned
  // apiKey: undefined,        ← Never returned
};
```

### 4. Scheduler & Job Queue (BullMQ)

#### Cron Trigger Registration (G2 Fix)

```
Workflow Activation Flow:

POST /workflows/:id/activate
  │
  ├─> WorkflowsService.activate(workflowId)
  │       │
  │       ├─> [Transaction Start]
  │       │
  │       ├─> 1. Update Workflow {status: ACTIVE}
  │       │
  │       ├─> 2. SchedulerService.registerSchedules(workflowId, graph)
  │       │
  │       │   For each cron.trigger node:
  │       │   ├─> jobName = `cron:{workflowId}:{nodeId}` ← G2 Fix
  │       │   │       (Scoped prevents cross-workflow collision)
  │       │   │
  │       │   ├─> BullMQ.queue.add(jobName, {
  │       │   │     workflowId,
  │       │   │     triggerNodeId,
  │       │   │     triggerPayload: {cron, timezone}
  │       │   │   }, {
  │       │   │     repeat: {pattern: cronPattern, tz: timezone}
  │       │   │   })
  │       │   │
  │       │   └─> PrismaService.cronSchedule.create({
  │       │         workflowId,
  │       │         cron,
  │       │         timezone,
  │       │         bullJobId: jobName  ← Store for deregister
  │       │       })
  │       │
  │       ├─> 3. WebhooksService.registerWebhooks(workflowId, graph)
  │       │       (Generate secure paths, rotate old endpoints)
  │       │
  │       ├─> 4. [Transaction Commit]
  │       │
  │       └─> Return {status: ACTIVE, webhooks, cronSchedules}
  │
  └─> Response 200 OK


Workflow Deactivation Flow:

POST /workflows/:id/deactivate
  │
  ├─> WorkflowsService.deactivate(workflowId)
  │       │
  │       ├─> SchedulerService.deregisterSchedules(workflowId)
  │       │
  │       │   ├─> Fetch all CronSchedule records for workflow
  │       │   │
  │       │   ├─> For each schedule:
  │       │   │   ├─> queue.removeRepeatableByKey(jobName)
  │       │   │   │       (Match by stored bullJobId, not pattern)
  │       │   │   │       ← G2 Fix: Prevents cross-workflow deletion
  │       │   │   │
  │       │   │   └─> prisma.cronSchedule.delete({id})
  │       │   │
  │       │   └─> Log success
  │       │
  │       └─> Update Workflow {status: INACTIVE}
  │
  └─> Response 200 OK
```

#### Job Scoping Example (G2 Fix)

```
Scenario: Two workflows with same cron pattern

Workflow A (id: wf_A)
  └─ Node: cron.trigger (id: n1, pattern: "0 * * * *")
     Job name: "cron:wf_A:n1"

Workflow B (id: wf_B)
  └─ Node: cron.trigger (id: n1, pattern: "0 * * * *")
     Job name: "cron:wf_B:n1"

Deactivating Workflow A:
  ├─> Stored bullJobId = "cron:wf_A:n1"
  ├─> queue.removeRepeatableByKey("cron:wf_A:n1")
  └─> Workflow B's job "cron:wf_B:n1" UNAFFECTED ✓

Without G2 fix (old behavior):
  ├─> Pattern-based removal: pattern = "0 * * * *"
  ├─> Removes BOTH "cron:wf_A:n1" and "cron:wf_B:n1"
  └─> Workflow B's job DELETED (BUG) ✗
```

### 5. Real-Time Execution Tracking (SSE Stream)

#### Execution Status Flow (G3 Fix)

```
Worker executes node:

┌─────────────────────────────────────────────────┐
│  WorkerProcessor.executeNode(node, inputs)      │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. Create ExecutionStep {status: RUNNING}     │
│     ├─> INSERT INTO execution_step             │
│     │   {executionId, nodeId, status: RUNNING, │
│     │    startedAt: NOW(), ...}                 │
│     │                                           │
│     │   @@unique([executionId, nodeId]) ensures│
│     │   no duplicate steps (G3 fix)            │
│     │                                           │
│     └─> Emit upsert event for SSE stream       │
│         (Notifies frontend: "Node is RUNNING") │
│                                                 │
│  2. Execute node (Promise.race timeout guard)  │
│     const result = await executeNode(...)      │
│                                                 │
│  3. Update ExecutionStep {status: SUCCESS}     │
│     ├─> UPDATE execution_step                  │
│     │   SET status = SUCCESS,                  │
│     │       output = {...},                    │
│     │       durationMs = elapsed,              │
│     │       endedAt = NOW()                    │
│     │   WHERE executionId = ? AND nodeId = ?   │
│     │                                           │
│     │   (Uses @@unique constraint to target    │
│     │    exact step record)                    │
│     │                                           │
│     └─> Emit upsert event for SSE stream       │
│         (Notifies frontend: "Node SUCCESS")    │
│                                                 │
│  4. Continue to next nodes in DAG              │
│                                                 │
└─────────────────────────────────────────────────┘
```

#### SSE Stream Endpoint (Real-Time Frontend Updates)

```
Frontend: const eventSource = new EventSource(
  '/executions/exec_123/stream?token=' + jwtToken
)

Backend: GET /executions/:id/stream

@Get(':id/stream')
async streamExecution(
  @Param('id') executionId: string,
  @Query('token') token: string,
  @Res() res: Response
) {
  // Verify JWT from query param (browsers can't send auth headers with EventSource)
  const {userId, workspaceId} = this.jwtService.verify(token);
  
  // Verify execution belongs to user's workspace
  const execution = await this.prisma.execution.findFirst({
    where: {
      id: executionId,
      workflow: {workspaceId}
    }
  });
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Stream initial state
  const steps = await this.prisma.executionStep.findMany({
    where: {executionId},
    orderBy: {createdAt: 'asc'}
  });
  
  res.write('data: ' + JSON.stringify({
    type: 'initial_state',
    steps: steps.map(s => ({
      nodeId: s.nodeId,
      status: s.status,
      output: s.output,
      durationMs: s.durationMs
    }))
  }) + '\n\n');

  // Subscribe to Redis pub/sub for step updates
  const subscription = await redis.subscribe(
    `execution:${executionId}:updates`
  );

  // Forward updates to client
  subscription.on('message', (channel, payload) => {
    res.write('data: ' + payload + '\n\n');
  });

  // Cleanup on disconnect
  res.on('close', () => {
    subscription.unsubscribe();
  });
}

Frontend listener:
eventSource.addEventListener('message', (event) => {
  const {type, steps} = JSON.parse(event.data);
  
  if (type === 'initial_state') {
    // Render initial execution state
    renderSteps(steps);
  } else if (type === 'step_update') {
    // Animate step status change (RUNNING → SUCCESS)
    updateStepUI(event.nodeId, event.status);
  }
});
```

---

## Multi-Tenancy & Isolation

### Workspace Boundaries

```
User Authentication Flow:

POST /auth/login {email, password}
  │
  └─> AuthService.login(email, password)
      ├─> Hash password with bcrypt
      ├─> Verify against User.passwordHash
      ├─> Load User.memberships (WorkspaceMember[])
      │
      │   User can belong to multiple workspaces:
      │   ├─ Workspace A (role: OWNER)
      │   ├─ Workspace B (role: ADMIN)
      │   └─ Workspace C (role: MEMBER)
      │
      ├─> Generate JWT {userId, workspaceId: primary, exp: ...}
      │   (Primary workspace stored in JWT claims)
      │
      └─> Return {token, workspaceId, role}


Query Isolation (Example):

GET /workflows — List workflows for current workspace

@Get()
@UseGuards(AuthGuard('jwt'))
async findAll(@Req() req: any) {
  // req.user = {id, workspaceId} from JWT
  
  return this.prisma.workflow.findMany({
    where: {
      workspaceId: req.user.workspaceId  ← Enforced at query level
    }
  });
}

Query output: Only workflows in user's workspace
Database query:
  SELECT * FROM workflow
  WHERE workspace_id = 'ws_12345'  ← Filter always applied
```

### Data Isolation Verification (C1 Fix)

```
Before C1 Fix (SECURITY HOLE):
  WorkerProcessor.executeNode(credId, nodeConfig)
    └─> Fetch credential without workspaceId check
        SELECT * FROM credential WHERE id = credId
        
        Risk: If credId from different workspace leaked,
              attacker can use it

After C1 Fix:
  WorkerProcessor.executeNode(credId, nodeConfig, executionContext)
    └─> Fetch credential WITH workspace filter
        SELECT * FROM credential
        WHERE id = credId AND workspace_id = execution.workspace_id
        
        Guarantee: Credential must belong to execution's workspace
                   Cross-workspace data access prevented
```

---

## Error Handling & Recovery

### Execution Failure Scenarios

```
Scenario 1: Node Timeout (execute.command takes 45s, limit 30s)
├─> ProcessHandler detects timeout
├─> Child process killed (SIGTERM → SIGKILL)
├─> ExecutionStep updated {status: FAILED, error: "Timeout after 30s"}
├─> Parent node receives error input
└─> Workflow continues (error path) or halts

Scenario 2: Invalid Credential Format
├─> Worker fails to decrypt credential (bad IV/tag)
├─> EncryptionUtil throws DecryptionError
├─> WorkerProcessor catches, updates step {status: FAILED}
├─> error: "Credential decryption failed — invalid password?"
└─> User notified via UI

Scenario 3: Database Connection Loss
├─> BullMQ retries job (exponential backoff, 3 attempts)
├─> On final failure, job moved to dead-letter queue
├─> Execution marked {status: FAILED, error: "DB connection timeout"}
├─> Alert sent to admin (if configured)
└─> Manual retry available via UI

Scenario 4: Node Registry Missing (e.g., custom node not installed)
├─> GraphValidator catches during workflow activation
├─> Returns validation error: "Node type 'custom.node' not found in registry"
├─> Workflow stays INACTIVE
└─> Developer deploys missing node, retries activation
```

### Dead-Letter Queue & Monitoring

```
BullMQ Configuration:

queue.add(jobName, data, {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000  // 2s, 4s, 8s
  },
  removeOnComplete: true,    // Delete successful jobs
  removeOnFail: false        // Keep failed jobs for analysis
});

Failed Job Handling:

┌─ Attempt 1 (0s) ──────────┐
│ Error: Connection timeout │
│ Retry scheduled: +2s      │
└─────────────────────────────┘
         ↓
┌─ Attempt 2 (2s) ──────────┐
│ Error: Connection timeout │
│ Retry scheduled: +4s      │
└─────────────────────────────┘
         ↓
┌─ Attempt 3 (6s) ──────────┐
│ Error: Connection timeout │
│ All retries exhausted      │
└─────────────────────────────┘
         ↓
┌──────────────────────────┐
│  DEAD-LETTER QUEUE       │
│  Job ID: j_xyz           │
│  Execution: exec_123     │
│  Reason: Max retries hit │
│  Timestamp: 2026-06-09   │
└──────────────────────────┘

Monitor Query:
SELECT * FROM bullmq_jobs
WHERE status = 'failed' AND attempts >= 3
ORDER BY timestamp DESC;
```

---

## Performance Characteristics

### Latency Budget (P95)

| Operation | Target | Actual |
|-----------|--------|--------|
| JWT validation | < 5ms | ~2ms |
| Workflow fetch (with graph) | < 50ms | ~35ms |
| Execution start (create + queue) | < 100ms | ~80ms |
| Credential decrypt (AES-256-GCM) | < 30ms | ~15ms |
| Node execute (user code) | 30s timeout | varies |
| SSE event emission | < 10ms | ~5ms |

### Throughput (BullMQ)

- **Single worker:** ~100 jobs/sec (depends on node duration)
- **10 workers:** ~1000 jobs/sec (linear scaling)
- **Queue backpressure:** Auto-pauses consumers if Redis memory > threshold

### Database Connections

```
Prisma Configuration:
├─ connection_limit: 20
├─ pool: "transaction"
├─ idle_timeout: 300s
└─ acquire_timeout: 30s

Scaling:
├─ Per-API-instance: 20 connections
├─ Per-worker-instance: 5 connections (lighter workload)
└─ Total for 5 API + 10 workers: (5×20) + (10×5) = 150 connections
```

---

## Security Considerations

### Authentication
- **JWT:** Standard HS256 (HMAC-SHA256) with 24h expiration
- **Refresh:** Optional refresh token endpoint (Phase 2)
- **HTTPS:** Required in production (enforced at reverse proxy)

### Authorization
- **RBAC:** Owner > Admin > Member (resource-level checks in service layer)
- **Workspace isolation:** All queries filtered by workspaceId
- **API key rate limiting:** 1000 req/min per user (Phase 2)

### Encryption
- **At rest:** AES-256-GCM for credentials (hardware-accelerated on modern CPUs)
- **In transit:** TLS 1.3 (enforced by Node.js/Express)
- **Key management:** Single ENCRYPTION_KEY in environment (rotate Phase 2)

### Input Validation
- **Zod schemas:** All endpoint inputs validated before processing
- **Graph validation:** DAG check, node type existence, config schema
- **SSRF protection:** http.request node blocks private IPs (127.0.0.1, 10.x, etc.)

---

## Deployment Topology

### Single-Server Deployment
```
┌──────────────────┐
│ nginx (reverse   │
│ proxy, TLS)      │
└────────┬─────────┘
         │ :3000 (API backend)
    ┌────▼────┬─────────────┐
    │ NestJS  │ Worker Pool │
    │ API     │ (same proc) │
    │ Process │             │
    └────┬────┴─────────────┘
         │
    ┌────▼──────────┐
    │ PostgreSQL    │
    │ Redis (Queue) │
    └───────────────┘
```

### Distributed Deployment
```
┌───────────────┐       ┌───────────────┐
│ API Instance 1│       │ API Instance 2│
│ (:3000)       │       │ (:3001)       │
└─────┬─────────┘       └────────┬──────┘
      │ Load Balancer (nginx/HAProxy) │
      │                              │
      └──────────────┬───────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
    ┌───▼──┐  ┌──────▼─────┐  ┌──▼────┐
    │ API  │  │ Worker 1-4 │  │Worker  │
    │Cache │  │ (separate  │  │Pool 2  │
    │Redis │  │ containers)│  │       │
    └──────┘  └────────────┘  └──────┘
                    │
        ┌───────────┴───────────┐
        │                       │
    ┌───▼────┐         ┌──────▼──┐
    │PostgreSQL│        │Redis    │
    │(Primary) │        │(Queue)  │
    │          │        │         │
    └──────────┘        └─────────┘
```

---

## Technology Stack Summary

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend** | Next.js | 14.2 | SSR, React components, SSE client |
| **Backend** | NestJS | 10.3 | REST API, DI, modular architecture |
| **Database** | PostgreSQL | 13+ | Primary state store |
| **Queue** | BullMQ + Redis | 5.1 + 6+ | Job queue, real-time pub/sub |
| **Auth** | JWT + Passport | 4.0.1 | Stateless authentication |
| **Encryption** | crypto (Node.js) | Built-in | AES-256-GCM credential vault |
| **ORM** | Prisma | 5.8.1 | Type-safe DB queries |
| **Validation** | Zod | 3.22 | Runtime schema validation |
| **Testing** | Jest | 29.7 | Unit tests, mocks |

---

## References & Related Docs

- **Project Overview:** `./project-overview-pdr.md`
- **Code Standards:** `./code-standards.md`
- **Development Roadmap:** `./development-roadmap.md`
- **API Documentation:** `./api-docs.md` (to be created)
- **Deployment Guide:** `./deployment-guide.md` (to be created)
