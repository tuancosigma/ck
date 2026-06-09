# Antigravity Node Flow - SaaS Workflow Automation Platform

Antigravity Node Flow is a production-grade, highly-extensible, visual workflow automation SaaS platform inspired by n8n. It leverages a decoupled monorepo architecture (API, UI, and Queue Worker) to coordinate Directed Acyclic Graphs (DAGs) on top of NestJS, Next.js, PostgreSQL, Redis, and BullMQ.

---

## 🛠️ Technology Stack

*   **Frontend**: Next.js 14 App Router, TypeScript, React Flow visual canvas, Zustand, TailwindCSS, TanStack Query.
*   **Backend API**: NestJS Core, Prisma ORM, PostgreSQL, BullMQ, Redis, Zod, JWT Passport Auth.
*   **Worker Queue**: Standalone lightweight NestJS microservice, ioredis, custom NodeJS VM sandboxes.
*   **Infrastructure**: Docker Compose (PostgreSQL 15 + Redis 7).

---

## 🏗️ Monorepo Structures

```
├── /apps
│   ├── /web       # Next.js visual dashboard editor canvas
│   ├── /api       # Primary REST endpoints & BullMQ repeatable job registration
│   └── /worker    # BullMQ worker executing workflow DAGs and streaming steps logs
│
├── /packages
│   ├── /workflow-core  # Graph cycle check validation and topological sorters
│   ├── /node-registry   # modular Triggers & Actions nodes executors
│   └── /shared-types    # Global Zod validator models & shared TS interfaces
│
└── /infra         # Docker Compose PostgreSQL and Redis stacks
```

---

## 🚀 Setup & Launch Instructions

Follow these systematic steps to boot the entire monorepo stack locally:

### 1. Prerequisite Installations
*   Ensure that **NodeJS (v18+)**, **pnpm (v9+)**, and **Docker Desktop** are installed and running on your host system.

### 2. Boot Docker Infrastructure Stacks
Spin up PostgreSQL and Redis in the background:
```bash
docker-compose -f infra/docker-compose.yml up -d
```

### 3. Install Monorepo Dependencies
Restore pnpm workspace dependencies cleanly:
```bash
pnpm install
```

### 4. Setup Local Environments
Create an `.env` configuration file inside `apps/api/.env` (and copy to `apps/worker/.env`):
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/n8n_clone?schema=public"
REDIS_HOST="localhost"
REDIS_PORT=6379
JWT_SECRET="super-secure-jwt-passphrase-change-in-prod"
MASTER_KEY="secure-aes-256-gcm-master-key-change-in-prod"
PORT=3001
```

### 5. Generate and Run Database Migrations
Provision model tables and trigger Prisma Client compilations:
```bash
pnpm prisma:migrate
pnpm prisma:generate
```

### 6. Build Packages in Dependency Order
Compile shared monorepo packages so their TypeScript declarations are linked:
```bash
pnpm --filter @n8n-clone/shared-types build
pnpm --filter @n8n-clone/workflow-core build
pnpm --filter @n8n-clone/node-registry build
```

### 7. Launch Development Servers (HMR)
Start all microservices in parallel:
```bash
pnpm dev
```
Alternatively, you can boot individual services in separate terminals:
*   **Web Dashboard Editor**: `pnpm dev:web` (runs on [http://localhost:3000](http://localhost:3000))
*   **NestJS API Server**: `pnpm dev:api` (runs on [http://localhost:3001](http://localhost:3001))
*   **BullMQ Task Worker**: `pnpm dev:worker`

---

## 🔒 Security Operations Checklist

This platform enforces state-of-the-art secure engineering protocols:
*   **Credentials GCM Vault**: Plaintext SMTP and Database passwords are AES-256-GCM encrypted. They are never returned via public APIs.
*   **Anti-SSRF Shield**: Resolves public DNS mappings to intercept loopbacks/internal IPs (localhost, AWS instance metadata `169.254.169.254`) at request time.
*   **CPU Infinite Loop vm Sandbox**: Wraps custom JS scripts inside async IIFE sandboxes with 5000ms execution timeouts.
*   **Sensitive Log Masking**: Automatically strips tokens, keys, and passwords from workflow execution step database logs.
