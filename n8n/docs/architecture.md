# Technical Architecture Guide - Visual Workflow Builder

This document outlines the detailed system architecture, execution mechanics, and scheduler pipeline for the visual workflow platform.

---

## 1. Monorepo Service Blueprint

The platform is constructed as a decoupled **pnpm workspace monorepo** containing three standalone services and three modular packages:

```
├── /apps
│   ├── /web       # Next.js 14 App Router, React Flow visual canvas, Zustand, Tailwind
│   ├── /api       # NestJS API backend, JWT auth, CRUD vault, BullMQ Scheduler
│   └── /worker    # BullMQ node queue consumer, isolated JS Sandbox, pg clients
│
├── /packages
│   ├── /workflow-core  # Graph Cycle validation, Kahn's Topological Sorter, Abort triggers
│   ├── /node-registry   # Standard 9 Triggers & Action executors, ExpressionResolver
│   └── /shared-types    # Global shared Zod Validation schemas & TypeScript definitions
```

---

## 2. DAG Cycle Detection & Execution Engine

Visual graphs created by users represent a **Directed Acyclic Graph (DAG)**. 

### A. Cycle Checks (DFS Coloring)
To prevent infinite execution lock loops, the API and visual editor run a DFS-based Graph Coloring cycle detector before saving any graphs:
*   `0 (Unvisited)`: Default state.
*   `1 (Visiting)`: In progress. If a DFS traversal path encounters a node already flagged as `1`, a **back edge** exists, signaling a cycle. The saving transaction is aborted.
*   `2 (Visited)`: Completely mapped.

### B. Topological Sorting (DFS Post-Order)
Since action execution order is dependent on predecessor outputs, the engine resolves dependency orders using a reverse-post-order DFS stack:
1.  Visits each node and recursively resolves its neighbors.
2.  Pushes node ID to a stack once all downstream branches have been traversed.
3.  Reverses the resolved stack to yield a strict topological array: `[Trigger, ActionA, ActionB]`.

### C. Dynamic Traversal with Branching
Static topological listing does not suffice for conditional branching (e.g. `logic.if` nodes). Our engine implements a hybrid traversal:
*   Nodes are iterated in topological order.
*   Nodes are only executed if they have received active propagation data from a parent node.
*   Upon executing an `IF` node, the node returns a `nextBranch: "true" | "false"`.
*   The engine filters outgoing edges. Downstream nodes on the non-selected branch receive no data and are automatically marked as `SKIPPED`.

---

## 3. Asynchronous Queue & Scheduler Pipeline

Scheduler engines do not block web server threads. BullMQ backed by a Redis broker coordinates scheduling asynchronously:

```
[User toggles Active] ──> [API Server] ──> [BullMQ repeatable job]
                                                    │ (cron schedule)
                                                    ▼
[PostgreSQL Steps] <── [Worker Process] <── [Redis Queue event]
```

1.  **Workflow Activation**: When a user toggles a workflow containing `cron.trigger` to `ACTIVE`, the API server registers a repeatable job in BullMQ under a unique job ID `cron:${workflowId}:${nodeId}`, passing the cron pattern and timezone.
2.  **Workflow Deactivation**: The API removes the repeatable job from Redis, preventing further triggers.
3.  **Queue Consuming**: When a cron or manual event fires, BullMQ schedules a single execution task in Redis. Available worker instances poll Redis, lock the task, fetch decryptions, run the engine, and update the persistent logs.

---

## 4. Webhook Delivery Models

Webhooks support two distinct response configurations:
*   `Immediate Mode (Asynchronous)`: Receives payload, creates a `QUEUED` database execution, enqueues the job in BullMQ, and immediately returns a `202 Accepted` response.
*   `Sync Mode (Synchronous)`: Crucial for HTTP responders. It enqueues the job and starts a controlled 200ms interval polling loop in the NestJS thread. It queries the execution state for up to 30 seconds. When the worker maps the final step, the API resolves the final node's masked JSON output directly to the webhook post caller.
