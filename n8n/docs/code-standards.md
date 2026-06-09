# Code Standards & Codebase Structure

## Project Organization

```
n8n/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── main.ts                    # Bootstrap, app initialization
│   │   │   ├── app.module.ts              # Root module, dependency injection
│   │   │   │
│   │   │   ├── auth/                      # Authentication & authorization
│   │   │   │   ├── auth.service.ts        # JWT generation, validation
│   │   │   │   ├── auth.controller.ts     # POST /auth/login, POST /auth/register
│   │   │   │   ├── jwt.strategy.ts        # Passport JWT strategy
│   │   │   │   └── auth.module.ts
│   │   │   │
│   │   │   ├── workflows/                 # Workflow CRUD & lifecycle
│   │   │   │   ├── workflows.service.ts   # Create, read, update, delete, activate/deactivate
│   │   │   │   ├── workflows.service.spec.ts
│   │   │   │   ├── workflows.controller.ts # REST endpoints
│   │   │   │   └── workflows.module.ts
│   │   │   │
│   │   │   ├── executions/                # Execution history & real-time tracking
│   │   │   │   ├── executions.controller.ts # GET /executions, GET /executions/:id/stream
│   │   │   │   ├── executions.module.ts
│   │   │   │   └── (service logic moved to workflows, scheduler)
│   │   │   │
│   │   │   ├── scheduler/                 # Cron trigger registration
│   │   │   │   ├── scheduler.service.ts   # registerSchedules, deregisterSchedules
│   │   │   │   ├── scheduler.service.spec.ts
│   │   │   │   └── scheduler.module.ts
│   │   │   │
│   │   │   ├── credentials/               # Credential vault & encryption
│   │   │   │   ├── credentials.service.ts # CRUD, encryption/decryption
│   │   │   │   ├── credentials.service.spec.ts
│   │   │   │   ├── credentials.controller.ts # REST endpoints
│   │   │   │   ├── encryption.util.ts     # AES-256-GCM encrypt/decrypt
│   │   │   │   ├── credentials.module.ts
│   │   │   │   └── (no privacy exports — use service only)
│   │   │   │
│   │   │   ├── webhooks/                  # Webhook endpoints & routing
│   │   │   │   ├── webhooks.controller.ts # Dynamic route handlers
│   │   │   │   ├── webhooks.service.ts    # Endpoint generation, cleanup
│   │   │   │   └── webhooks.module.ts
│   │   │   │
│   │   │   ├── queue/                     # BullMQ wrapper & job processing
│   │   │   │   ├── queue.service.ts       # addJob, getQueue, removeJob
│   │   │   │   ├── worker.processor.ts    # Job handler, node execution logic
│   │   │   │   ├── worker.processor.spec.ts
│   │   │   │   └── queue.module.ts
│   │   │   │
│   │   │   ├── workspace/                 # Multi-tenancy & isolation
│   │   │   │   ├── workspace.service.ts   # Workspace CRUD
│   │   │   │   ├── workspace.controller.ts # REST endpoints
│   │   │   │   └── workspace.module.ts
│   │   │   │
│   │   │   ├── prisma/                    # Database client & schema
│   │   │   │   ├── prisma.service.ts      # Lazy-loaded Prisma client
│   │   │   │   └── prisma.module.ts
│   │   │   │
│   │   │   └── metrics/                   # Observability (Phase 2)
│   │   │       ├── metrics.controller.ts  # Prometheus endpoint
│   │   │       ├── metrics.service.ts     # Counter/gauge tracking
│   │   │       └── metrics.module.ts
│   │   │
│   │   ├── prisma/
│   │   │   ├── schema.prisma              # Data schema definition
│   │   │   └── migrations/
│   │   │       ├── migration_lock.toml
│   │   │       └── 20260609000001_execution_step_running_status/
│   │   │           └── migration.sql      # Add RUNNING status, @@unique constraint
│   │   │
│   │   ├── test/                          # Integration & E2E tests
│   │   │   └── fixtures/                  # Mock workflows, credentials
│   │   │
│   │   ├── tsconfig.json                  # TypeScript config (strict mode)
│   │   ├── jest.config.js                 # Test runner config
│   │   ├── package.json                   # Dependencies: NestJS, Prisma, BullMQ
│   │   └── .env.example                   # Environment variables template
│   │
│   └── web/                               # Next.js 14 frontend
│       ├── app/                           # App Router
│       ├── components/                    # React components
│       ├── lib/                           # Utilities, API client
│       └── public/                        # Static assets
│
├── packages/
│   ├── shared-types/
│   │   ├── src/
│   │   │   ├── workflow.types.ts          # WorkflowGraph, Node, Edge types
│   │   │   ├── execution.types.ts         # Execution, ExecutionStep types
│   │   │   ├── credential.types.ts        # Credential types
│   │   │   └── index.ts                   # Re-exports
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── workflow-core/
│   │   ├── src/
│   │   │   ├── graph-validator.ts         # DAG validation, node type checking
│   │   │   ├── graph-traverser.ts         # Topological sort, dependency resolution
│   │   │   ├── error.types.ts             # WorkflowError, ValidationError
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── node-registry/
│       ├── src/
│       │   ├── base-node.ts               # Abstract node class
│       │   ├── nodes/
│       │   │   ├── triggers/
│       │   │   │   ├── manual-trigger.ts
│       │   │   │   ├── cron-trigger.ts
│       │   │   │   └── webhook-trigger.ts
│       │   │   ├── actions/
│       │   │   │   ├── http-request.ts
│       │   │   │   ├── email-smtp.ts
│       │   │   │   └── (30+ more)
│       │   │   ├── logic/
│       │   │   │   ├── if-branching.ts
│       │   │   │   ├── switch-case.ts
│       │   │   │   └── loop-over-items.ts
│       │   │   └── transforms/
│       │   │       ├── json-transform.ts
│       │   │       └── csv-parse.ts
│       │   ├── registry.ts                # Node registration & lookup
│       │   ├── schemas/                   # Zod config schemas per node
│       │   │   ├── http-request.schema.ts
│       │   │   ├── email-smtp.schema.ts
│       │   │   └── (etc.)
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
│
└── docs/                                  # Project documentation
    ├── project-overview-pdr.md            # Overview & requirements
    ├── system-architecture.md             # Architecture, data flow, components
    ├── code-standards.md                  # This file
    ├── codebase-summary.md                # Auto-generated repomix summary
    ├── development-roadmap.md             # Milestones, phases, progress
    ├── api-docs.md                        # REST API reference
    └── deployment-guide.md                # Production setup, scaling
```

---

## TypeScript & NestJS Conventions

### File Naming
- **Controllers:** `{domain}.controller.ts` — e.g., `workflows.controller.ts`
- **Services:** `{domain}.service.ts` — e.g., `workflows.service.ts`
- **Modules:** `{domain}.module.ts` — e.g., `workflows.module.ts`
- **Utilities:** `{purpose}.util.ts` — e.g., `encryption.util.ts`
- **Types/Interfaces:** `{domain}.types.ts` or inline in `shared-types/`
- **Tests:** `{file}.spec.ts` — e.g., `workflows.service.spec.ts`
- **Migrations:** `{timestamp}_{slug}/migration.sql` — e.g., `20260609000001_execution_step_running_status/`

### Class Naming (PascalCase)
```typescript
// Service
export class WorkflowsService {
  constructor(private prisma: PrismaService) {}
}

// Controller
@Controller('workflows')
export class WorkflowsController {
  constructor(private workflowsService: WorkflowsService) {}
}

// Module
@Module({
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}

// Guard
export class WorkspaceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // Check if user's workspace matches resource workspace
  }
}
```

### Method Naming (camelCase)
```typescript
// Async operations
async createWorkflow(workspaceId: string, name: string) {}
async findWorkflowById(id: string) {}
async updateWorkflow(id: string, data: Partial<Workflow>) {}
async deleteWorkflow(id: string) {}

// Synchronous operations
encryptCredential(plaintext: string): EncryptedData {}
validateGraph(graph: WorkflowGraph): ValidationResult {}

// Lifecycle hooks
onModuleInit() {}
beforeApplicationShutdown(signal?: string) {}

// Logical operations
registerSchedules(workflowId: string, graph: WorkflowGraph) {}
deregisterSchedules(workflowId: string) {}
emitNodeStatus(executionId: string, nodeId: string, status: StepStatus) {}
```

### Variable Naming (camelCase)
```typescript
// Constants (UPPER_SNAKE_CASE)
const DEFAULT_EXECUTION_TIMEOUT_MS = 30000;
const AES_ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const JWT_EXPIRATION_HOURS = 24;

// Variables
const workflowId = 'wf_123';
const executionSteps: ExecutionStep[] = [];
const encryptedData: Buffer = Buffer.from(...);
const isWorkflowActive = true;

// Private class members (prefix underscore)
private _cacheMap = new Map();
private _logger = new Logger(ServiceName.name);
```

### Type Definitions (shared-types/)
```typescript
// workflow.types.ts
export interface WorkflowGraph {
  version: string;
  nodes: Node[];
  edges: Edge[];
}

export interface Node {
  id: string;
  type: string;  // e.g., "http.request", "email.smtp"
  name: string;
  position: {x: number, y: number};
  config: Record<string, any>;
}

export interface Edge {
  source: string;
  target: string;
  label?: string;  // For conditional routing
}

export enum WorkflowStatus {
  INACTIVE = 'INACTIVE',
  ACTIVE = 'ACTIVE'
}

// execution.types.ts
export enum StepStatus {
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED'
}

export interface ExecutionStep {
  id: string;
  executionId: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: StepStatus;
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: Record<string, any>;
  durationMs?: number;
  startedAt?: Date;
  createdAt: Date;
}
```

---

## Error Handling & Validation

### Exception Handling (NestJS Built-in)
```typescript
import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException
} from '@nestjs/common';

// Service layer — throw exceptions
@Injectable()
export class WorkflowsService {
  async findOne(workspaceId: string, id: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, workspaceId }
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found.');
    }

    if (workflow.status === 'ACTIVE' && !this.canModify(workflow)) {
      throw new ForbiddenException('Cannot modify active workflow.');
    }

    return workflow;
  }
}

// Global exception filter (app.module.ts)
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = 500;
    let message = 'Internal server error';
    let error = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      message = (response as any).message || exception.message;
    } else if (exception instanceof Error) {
      message = exception.message;
      error = {
        name: exception.name,
        stack: process.env.NODE_ENV === 'development' ? exception.stack : undefined
      };
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url
    });
  }
}
```

### Input Validation (Zod + class-validator)
```typescript
import { z } from 'zod';
import { IsString, IsNumber, IsOptional, ValidateNested } from 'class-validator';

// Zod schema (for request validation, can be used in node configs)
const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  graph: z.object({
    version: z.string(),
    nodes: z.array(z.object({
      id: z.string(),
      type: z.string(),
      name: z.string(),
      position: z.object({x: z.number(), y: z.number()}),
      config: z.record(z.any())
    })),
    edges: z.array(z.object({
      source: z.string(),
      target: z.string(),
      label: z.string().optional()
    }))
  })
});

type CreateWorkflowDto = z.infer<typeof CreateWorkflowSchema>;

// class-validator DTO (for NestJS request body)
export class CreateWorkflowDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @ValidateNested()
  @Type(() => WorkflowGraphDto)
  graph?: WorkflowGraphDto;
}

// Controller validation pipe
@Post()
async create(
  @Body(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true
  })) dto: CreateWorkflowDto
) {
  // Parse & validate
  const validated = CreateWorkflowSchema.parse(dto);
  return this.workflowsService.create(validated);
}
```

---

## Testing Standards

### Unit Tests (Jest)
```typescript
// Format: {feature}.spec.ts
// Location: Same directory as implementation file

describe('WorkflowsService', () => {
  let service: WorkflowsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowsService,
        {
          provide: PrismaService,
          useValue: {
            workflow: {
              create: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              delete: jest.fn()
            },
            $transaction: jest.fn()
          }
        }
      ]
    }).compile();

    service = module.get(WorkflowsService);
    prisma = module.get(PrismaService);
  });

  describe('create', () => {
    it('should create a new workflow with initial version', async () => {
      const workspaceId = 'ws_123';
      const input = {name: 'Test Workflow', description: 'Test'};

      (prisma.$transaction as jest.Mock).mockResolvedValue({
        id: 'wf_123',
        ...input,
        status: 'INACTIVE',
        activeVersion: 1
      });

      const result = await service.create(workspaceId, input.name, input.description);

      expect(result).toHaveProperty('id');
      expect(result.status).toBe('INACTIVE');
      expect(result.activeVersion).toBe(1);
    });

    it('should throw NotFoundException if workspace does not exist', async () => {
      const workspaceId = 'ws_invalid';

      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error('Workspace not found')
      );

      await expect(
        service.create(workspaceId, 'Test', undefined)
      ).rejects.toThrow();
    });
  });

  describe('deregisterSchedules', () => {
    it('should remove repeatable jobs by exact job name (G2 fix)', async () => {
      const workflowId = 'wf_A';
      const schedules = [
        {workflowId, cron: '0 * * * *', timezone: 'UTC', bullJobId: 'cron:wf_A:n1'}
      ];

      // Mock queue methods
      const mockQueue = {
        getRepeatableJobs: jest.fn().mockResolvedValue([
          {name: 'cron:wf_A:n1', pattern: '0 * * * *'},
          {name: 'cron:wf_B:n1', pattern: '0 * * * *'}  // Different workflow
        ]),
        removeRepeatableByKey: jest.fn().mockResolvedValue(1)
      };

      // Should only remove cron:wf_A:n1, not cron:wf_B:n1
      await service.deregisterSchedules(workflowId);

      expect(mockQueue.removeRepeatableByKey).toHaveBeenCalledWith('cron:wf_A:n1');
    });
  });
});

// Node execution test example
describe('ExecuteCommandNode', () => {
  it('should timeout and kill child process after 30s', async () => {
    const node = new ExecuteCommandNode();
    const inputs = {command: 'sleep 60'};  // 60s command, 30s limit

    const start = Date.now();
    const result = await node.execute(inputs);

    const elapsed = Date.now() - start;
    expect(elapsed).toBeCloseTo(30000, -2);  // Within ~100ms
    expect(result.status).toBe('FAILED');
    expect(result.error).toContain('timeout');
  });

  it('should detect killed process on Windows', async () => {
    const node = new ExecuteCommandNode();
    const inputs = {command: 'invalid-command-xyz'};

    const result = await node.execute(inputs);

    expect(result.status).toBe('FAILED');
    expect(result.error).toBeDefined();
    // Verify error.killed flag set (Windows safe)
  });
});
```

### Test Coverage Expectations
- **Node implementations:** > 85% (all execution paths, timeout, error handling)
- **Service layer:** > 80% (CRUD, validation, isolation)
- **Controllers:** > 70% (routing, guards, serialization)
- **Overall target:** > 80% on critical paths

---

## Security Best Practices

### Credential Handling
```typescript
// ✅ GOOD: Encrypt immediately, no plaintext in logs
@Injectable()
export class CredentialsService {
  async create(workspaceId: string, name: string, type: string, data: any) {
    // Never log plaintext
    this.logger.debug(`Creating credential ${name} in workspace ${workspaceId}`);
    
    const {encryptedData, iv, tag} = this.encryptionUtil.encrypt(data);
    
    return this.prisma.credential.create({
      data: {
        workspaceId,
        name,
        type,
        encryptedData,
        iv,
        tag
      }
    });
  }

  async getForExecution(credId: string, workspaceId: string) {
    const cred = await this.prisma.credential.findUnique({
      where: {id: credId}
    });

    // C1 Fix: Always verify workspace ownership
    if (cred.workspaceId !== workspaceId) {
      throw new ForbiddenException('Credential does not belong to your workspace');
    }

    // Decrypt only in memory, never cache plaintext
    const plaintext = this.encryptionUtil.decrypt(cred);
    return plaintext;
  }
}

// ❌ BAD: Plaintext exposure
async getCredential(id: string) {
  const cred = await db.credential.findUnique({where: {id}});
  console.log('Credential:', JSON.stringify(cred.data));  // Logs plaintext!
  return cred;  // Exposes password field
}
```

### Authentication & Authorization
```typescript
// ✅ GOOD: JWT verified, workspace checked
@Controller('workflows')
@UseGuards(AuthGuard('jwt'))
export class WorkflowsController {
  @Get(':id')
  async findOne(
    @Req() req: any,  // User extracted by AuthGuard
    @Param('id') id: string
  ) {
    // req.user = {id: 'user_123', workspaceId: 'ws_456'}
    
    const workflow = await this.workflowsService.findOne(
      req.user.workspaceId,  // Pass workspace from JWT
      id
    );

    return workflow;
  }
}

// ✅ GOOD: Service enforces workspace isolation
@Injectable()
export class WorkflowsService {
  async findOne(workspaceId: string, id: string) {
    return this.prisma.workflow.findFirst({
      where: {
        id,
        workspaceId  // ← Always filter by workspace
      }
    });
  }
}

// ❌ BAD: Workspace not checked
async findOne(id: string) {
  return this.prisma.workflow.findUnique({where: {id}});
  // Any authenticated user can access any workflow!
}
```

### Input Validation & SSRF Protection
```typescript
// ✅ GOOD: Validate input, block private IPs
@Injectable()
export class HttpRequestNode extends BaseNode {
  private BLOCKED_IPS = [
    '127.0.0.1', '::1',
    '0.0.0.0', '::',
    /^10\.\d+\.\d+\.\d+$/,
    /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/,
    /^192\.168\.\d+\.\d+$/
  ];

  async execute(inputs: any) {
    const url = inputs.url;

    // Parse & validate URL
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error('Invalid URL format');
    }

    // Block private IPs (SSRF protection)
    const ip = parsed.hostname;
    const isBlocked = this.BLOCKED_IPS.some(pattern => {
      if (typeof pattern === 'string') {
        return ip === pattern;
      }
      return pattern.test(ip);
    });

    if (isBlocked) {
      throw new Error(`SSRF: Cannot access private IP ${ip}`);
    }

    // Proceed with request
    return axios.get(url, {timeout: 30000});
  }
}

// ❌ BAD: No validation
async execute(inputs: any) {
  return axios.get(inputs.url);  // Can access 127.0.0.1, internal APIs
}
```

### Encryption Key Management
```typescript
// ✅ GOOD: Key from environment, no hardcoding
export class EncryptionUtil {
  private readonly encryptionKey: Buffer;

  constructor(private configService: ConfigService) {
    const key = this.configService.get('ENCRYPTION_KEY');
    if (!key) {
      throw new Error('ENCRYPTION_KEY not set in environment');
    }
    this.encryptionKey = Buffer.from(key, 'base64');
  }

  encrypt(data: any): EncryptedData {
    const iv = crypto.randomBytes(16);  // Fresh IV every time
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      iv
    );

    // ... encryption logic ...

    return {
      encryptedData: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64')  // ← Include auth tag for integrity
    };
  }
}

// ❌ BAD: Hardcoded key
const ENCRYPTION_KEY = 'my-secret-key-12345';
encrypt(data) {
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, ...);
}
```

---

## Logging & Observability

### Structured Logging
```typescript
import { Logger } from '@nestjs/common';

@Injectable()
export class WorkflowsService {
  private readonly logger = new Logger(WorkflowsService.name);

  async activateWorkflow(workspaceId: string, workflowId: string) {
    this.logger.log(
      `Activating workflow ${workflowId} in workspace ${workspaceId}`
    );

    try {
      const result = await this.prisma.workflow.update({
        where: {id: workflowId},
        data: {status: 'ACTIVE'}
      });

      this.logger.log(
        `Workflow ${workflowId} activated successfully with ${result.webhooks?.length || 0} endpoints`
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to activate workflow ${workflowId}: ${error.message}`
      );
      throw error;
    }
  }
}

// Output (production):
// [WorkflowsService] Activating workflow wf_123 in workspace ws_456
// [WorkflowsService] Workflow wf_123 activated successfully with 2 endpoints

// Output (debug):
// [WorkflowsService] Activating workflow wf_123 in workspace ws_456
// [Prisma] SELECT * FROM workflow WHERE id = 'wf_123' AND workspace_id = 'ws_456'
```

### Sensitive Data Masking
```typescript
// ✅ GOOD: Mask credentials in logs
this.logger.debug('Executing node with credentials', {
  nodeId: 'n_123',
  credentialId: 'cred_456',
  credentialType: 'smtp',  // ← Type OK to log
  // password: undefined      // ← NEVER log plaintext
});

// ✅ GOOD: Log execution context without sensitive outputs
this.logger.log('Node execution completed', {
  executionId: 'exec_123',
  nodeId: 'n_456',
  status: 'SUCCESS',
  durationMs: 1250,
  outputKeys: Object.keys(output),  // ← Log keys only, not values
  // output: undefined  // ← Don't log sensitive data
});
```

---

## Database & Prisma Patterns

### Data Access Layer
```typescript
// ✅ GOOD: Isolated queries, workspace filtering
@Injectable()
export class WorkflowsService {
  async findAll(workspaceId: string) {
    return this.prisma.workflow.findMany({
      where: {workspaceId},  // ← Always filter
      include: {
        versions: {
          orderBy: {version: 'desc'},
          take: 1
        }
      },
      orderBy: {updatedAt: 'desc'}
    });
  }

  async findOne(workspaceId: string, id: string) {
    return this.prisma.workflow.findFirst({
      where: {id, workspaceId},  // ← Workspace + ID check
      include: {
        versions: true,
        webhooks: true,
        cronSchedules: true
      }
    });
  }
}

// Transactions for atomicity
async activateWorkflow(workspaceId: string, workflowId: string) {
  return this.prisma.$transaction(async (tx) => {
    // 1. Update workflow status
    const workflow = await tx.workflow.update({
      where: {id: workflowId},
      data: {status: 'ACTIVE'}
    });

    // 2. Register cron jobs (all or nothing)
    await this.schedulerService.registerSchedules(workflowId, workflow.graph);

    // 3. Register webhooks
    await this.webhooksService.registerWebhooks(workflowId, workflow.graph);

    return workflow;
  });
}

// ❌ BAD: No workspace filtering
async findOne(id: string) {
  return this.prisma.workflow.findUnique({where: {id}});  // Cross-workspace access!
}
```

### Migration Naming
```
migrations/
├── 20260609000001_execution_step_running_status/
│   └── migration.sql
├── 20260610000002_add_webhook_signature_verification/
│   └── migration.sql
└── 20260611000003_create_audit_log_table/
    └── migration.sql
```

Migration content:
```sql
-- 20260609000001_execution_step_running_status.sql

-- Add RUNNING status to StepStatus enum
ALTER TYPE "StepStatus" ADD VALUE 'RUNNING' BEFORE 'SUCCESS';

-- Add startedAt column (nullable, set when node_started event fires)
ALTER TABLE "ExecutionStep" ADD COLUMN "startedAt" TIMESTAMP;

-- Add unique constraint to prevent duplicate node steps per execution
ALTER TABLE "ExecutionStep" ADD CONSTRAINT "ExecutionStep_executionId_nodeId_unique" UNIQUE ("executionId", "nodeId");

-- Make durationMs nullable (NULL while RUNNING)
ALTER TABLE "ExecutionStep" ALTER COLUMN "durationMs" DROP NOT NULL;
```

---

## Performance Guidelines

### Database Query Optimization
```typescript
// ✅ GOOD: Select specific columns, eager load once
const executions = await this.prisma.execution.findMany({
  where: {workflowId, status: 'SUCCESS'},
  select: {
    id: true,
    status: true,
    createdAt: true,
    finishedAt: true,
    steps: {
      select: {
        nodeId: true,
        status: true,
        durationMs: true
      },
      orderBy: {createdAt: 'asc'}
    }
  },
  take: 50,  // Pagination
  skip: offset
});

// ❌ BAD: N+1 queries, loads unnecessary data
const executions = await this.prisma.execution.findMany();
for (const execution of executions) {
  execution.steps = await this.prisma.executionStep.findMany({
    where: {executionId: execution.id}  // ← Separate query per execution
  });
}
```

### Node Timeout Implementation
```typescript
// ✅ GOOD: Promise.race timeout guard (works for all node types)
async executeNode(nodeInstance: BaseNode, inputs: any, timeoutMs: number) {
  return Promise.race([
    nodeInstance.execute(inputs),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Node timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

// ✅ GOOD: OS-level timeout for sync commands
exec('command', {
  timeout: 30000,
  maxBuffer: 10 * 1024 * 1024,  // Prevent buffer overflow
  stdio: 'pipe'
});

// ❌ BAD: No timeout, infinite hang
exec('command');  // Can hang forever
```

---

## Documentation Requirements

### Code Comments (Minimal, High Signal)
```typescript
// ✅ GOOD: Explain WHY and non-obvious behavior

/**
 * Job name is scoped to workflowId + nodeId to prevent cross-workflow collision.
 * When deregistering, we match by exact job name, not pattern.
 * This prevents workflow A from deleting workflow B's cron job if they share a pattern.
 *
 * Example: Both wf_A:n1 and wf_B:n1 have pattern "0 * * * *"
 * - Stored bullJobId for wf_A: "cron:wf_A:n1"
 * - Removing by name only deletes wf_A's job, not wf_B's
 */
async deregisterSchedules(workflowId: string) {
  const schedules = await this.prisma.cronSchedule.findMany({where: {workflowId}});
  // ... remove by stored bullJobId
}

// ✅ GOOD: Complex algorithms explained

/**
 * Encrypt credential data with AES-256-GCM.
 * IMPORTANT: A fresh IV is generated on EVERY write to prevent known-plaintext attacks.
 * The authentication tag ensures ciphertext integrity (prevents tampering).
 */
encrypt(plaintext: any): {encryptedData: string, iv: string, tag: string} {
  const iv = crypto.randomBytes(16);  // Fresh IV prevents replay attacks
  const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
  // ...
}

// ❌ BAD: Obvious comments, noise

// Create a workflow
async create(workspaceId: string, name: string) {
  // Create workflow in database
  return this.prisma.workflow.create({data: {workspaceId, name}});
}

// ❌ BAD: No explanation of WHY, just WHAT

// Add job to queue
await this.queueService.addJob(jobName, data);
```

### Function Documentation (JSDoc)
```typescript
/**
 * Activate a workflow, registering cron triggers and webhooks.
 *
 * @param workspaceId - Workspace ID for isolation
 * @param workflowId - Workflow to activate
 * @returns Updated workflow with ACTIVE status
 * @throws NotFoundException if workflow not found
 * @throws ForbiddenException if workflow belongs to different workspace
 *
 * @example
 * const workflow = await this.activateWorkflow('ws_123', 'wf_456');
 * console.log(workflow.status); // "ACTIVE"
 */
async activateWorkflow(workspaceId: string, workflowId: string) {
  // ... implementation
}
```

---

## References

- **Project Overview:** `./project-overview-pdr.md`
- **System Architecture:** `./system-architecture.md`
- **Development Roadmap:** `./development-roadmap.md`
- **NestJS Docs:** https://docs.nestjs.com
- **Prisma Docs:** https://www.prisma.io/docs
- **TypeScript Handbook:** https://www.typescriptlang.org/docs
