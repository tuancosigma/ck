# Codebase Context

Last reviewed: 2026-05-29.

## What This Repo Is

This is a pnpm workspace monorepo for an n8n-inspired workflow automation platform named Antigravity Node Flow.

- `apps/web`: Next.js 14 App Router frontend with React Flow, Zustand, Tailwind, TanStack Query, and lucide icons.
- `apps/api`: NestJS REST API with Prisma/PostgreSQL, JWT auth, credentials vault, workflow CRUD, scheduler registration, webhook entrypoints, and execution history.
- `apps/worker`: NestJS BullMQ worker that pulls execution jobs from Redis, decrypts mapped credentials, runs workflow DAGs, and writes execution steps.
- `packages/shared-types`: Zod schemas and TypeScript types shared by frontend/backend.
- `packages/workflow-core`: Graph validation, topological sorting, and execution engine.
- `packages/node-registry`: Built-in node executors such as manual/cron/webhook triggers, HTTP request, IF logic, JS code, delay, SMTP email, and Postgres query.
- `infra/docker-compose.yml`: PostgreSQL and Redis local infrastructure.

## Runtime Flow

1. User authenticates through `apps/api/src/auth/*`; registration creates a default workspace and OWNER membership.
2. Frontend calls API through `apps/web/src/utils/api.ts`, storing JWT in `localStorage`.
3. Workflow CRUD lives in `apps/api/src/workflows/*`. Workflow definitions are versioned in `WorkflowVersion.graph`.
4. Graphs are validated with `WorkflowGraphSchema` and `GraphValidator` before save/activation.
5. Manual runs create an `Execution` row and enqueue `execute-workflow` into BullMQ.
6. Cron activation registers repeatable BullMQ jobs through `SchedulerService`.
7. Webhook calls enter through `apps/api/src/webhooks/webhooks.controller.ts`; sync mode polls the execution record for up to 30 seconds.
8. Worker loads the immutable workflow version, decrypts credentials, creates an `ExecutionEngine`, subscribes to engine events, and writes `ExecutionStep` logs.
9. Execution trace UI reads `/executions/:id` and reconstructs the React Flow graph from `workflow.versions`.

## Important Files

- API bootstrap: `apps/api/src/main.ts`
- API modules: `apps/api/src/app.module.ts`
- Prisma schema: `apps/api/prisma/schema.prisma`
- Queue wrapper: `apps/api/src/queue/queue.service.ts`
- Workflow service: `apps/api/src/workflows/workflows.service.ts`
- Execution history API: `apps/api/src/executions/executions.controller.ts`
- Worker processor: `apps/worker/src/worker.processor.ts`
- Execution engine: `packages/workflow-core/src/execution-engine.ts`
- Node registry: `packages/node-registry/src/index.ts`
- Frontend API client: `apps/web/src/utils/api.ts`
- Workflow dashboard: `apps/web/src/app/workflows/page.tsx`
- Workflow editor: `apps/web/src/app/workflows/[id]/editor/page.tsx`
- Execution list: `apps/web/src/app/executions/page.tsx`
- Execution trace: `apps/web/src/app/executions/[id]/page.tsx`
- Credentials UI: `apps/web/src/app/credentials/page.tsx`

## Current Known Good Checks

Use development/typecheck commands only during agent work. Do not run `npm run build`.

- `pnpm --recursive typecheck`
- `pnpm --filter api exec tsc --noEmit --incremental false -p tsconfig.json`
- `pnpm --filter worker exec tsc --noEmit --incremental false -p tsconfig.json`

`apps/api` and `apps/worker` now have `typecheck` scripts, so root recursive typecheck covers them.

## Cleanup Notes

- Generated build output should not be treated as source: `dist/`, `.next/`, and `*.tsbuildinfo`.
- `.claude/` appears to be a copied local agent skill cache, not application code. It is ignored by `.gitignore`.
- There is still duplicated sidebar/layout JSX in several frontend pages. A future cleanup should extract a shared app shell/sidebar component and route metadata.

## Recent Fixes From This Review

- Fixed `/executions/:id` API to include workflow versions so the execution trace page can reconstruct the graph.
- Fixed `ExecutionEngine` events to include node input in completed/failed events; worker log masking now receives the actual input.
- Added `/executions` frontend page and corrected sidebar links that previously routed “Execution History” back to `/workflows`.
- Added `.gitignore` entries for generated artifacts and copied tool caches.
- Added backend `typecheck` scripts without changing runtime behavior.
