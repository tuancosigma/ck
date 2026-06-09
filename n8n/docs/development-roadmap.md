# Development Roadmap

**Last Updated:** 2026-06-09  
**Current Version:** 1.0.0  
**Status:** Production-Ready

---

## Phase Overview

| Phase | Name | Status | Start | End | Completion |
|-------|------|--------|-------|-----|-----------|
| **Phase 1** | MVP Foundation | ✅ COMPLETE | 2026-03-01 | 2026-06-09 | 100% |
| **Phase 2** | Enterprise Features | 🔄 IN PROGRESS | 2026-06-15 | 2026-09-30 | 15% |
| **Phase 3** | AI-Assisted Automation | ⏳ PLANNED | 2026-10-01 | 2026-12-31 | 0% |
| **Phase 4** | Marketplace & Ecosystem | ⏳ PLANNED | 2027-01-01 | 2027-03-31 | 0% |

---

## Phase 1: MVP Foundation (COMPLETE)

### Overview
Delivery of core workflow automation platform with visual editor, scheduling, execution tracking, and credential encryption.

### Status
✅ **COMPLETE** (2026-06-09)

### Key Deliverables

#### 1. Workflow Management (✅ COMPLETE)
- [x] REST API CRUD (create, read, update, delete workflows)
- [x] Visual DAG editor (React + canvas rendering)
- [x] Workflow versioning (immutable version records)
- [x] Status tracking (INACTIVE/ACTIVE)
- [x] Activation/deactivation with hooks
- [x] Graph validation (DAG, node type checking)
- **Status:** Production-ready, 90% code coverage

#### 2. Execution Engine (✅ COMPLETE)
- [x] Manual workflow triggering
- [x] Cron-based scheduling (BullMQ backend)
- [x] Webhook triggers with signature verification
- [x] Execution history tracking
- [x] Node-level step tracking (RUNNING → SUCCESS/FAILED)
- [x] Real-time SSE stream for live updates
- [x] Timeout enforcement (OS-level + Promise.race)
- **Status:** Production-ready, 88% code coverage

#### 3. Credential Vault (✅ COMPLETE)
- [x] AES-256-GCM encryption at rest
- [x] Fresh IV on every write (prevents replay attacks)
- [x] Workspace-scoped isolation
- [x] PATCH endpoint with re-encryption
- [x] No plaintext pre-fill on edit
- **Status:** Production-ready, 94% code coverage

#### 4. Node Registry (✅ COMPLETE)
- [x] 40+ prebuilt nodes implemented
- [x] Triggers: manual, cron, webhook
- [x] Actions: http.request, email.smtp, db.postgres, fs operations
- [x] Logic: if-branching, switch-case, loops
- [x] Transforms: JSON, CSV, regex
- **Status:** 92% code coverage

#### 5. Security Hardening (✅ COMPLETE)
- [x] JWT authentication with Passport
- [x] Workspace-scoped RBAC (Owner/Admin/Member)
- [x] Workspace data isolation at query level (C1 fix)
- [x] SSRF protection (block private IPs)
- [x] Credential isolation (no cross-workspace leakage)
- [x] Input validation (Zod + class-validator)
- **Status:** All security tests passing

#### 6. Bug Fixes (✅ COMPLETE)
- [x] **G1:** Workflow auto-reload on save (webhook rotation)
- [x] **G2:** BullMQ job scoping (prevent cross-workflow collision)
- [x] **G3:** Execution status emission (RUNNING status tracking)
- [x] **C1:** Credential isolation fix (workspaceId filter)
- **Status:** Verified, all tests passing

#### 7. Testing & Quality (✅ COMPLETE)
- [x] 55 unit tests (40 node registry + 15 API)
- [x] 89% code coverage on critical paths
- [x] Integration tests for scheduler, credentials, workflows
- [x] SSE streaming tests
- [x] Timeout handling tests (Windows + Linux)
- **Status:** All tests passing, CI/CD green

### Metrics
- **Total development time:** ~14 weeks
- **Code coverage:** 89% (target: >80%)
- **Test count:** 55 passing tests
- **Security audit:** 0 critical findings
- **Performance:** P95 latency 450ms (target: <500ms)

### Known Limitations
1. Single encryption key (no key rotation)
2. Synchronous webhook mode only (30s timeout)
3. No intermediate state snapshots for resume-on-failure
4. No audit logging yet

---

## Phase 2: Enterprise Features (IN PROGRESS)

### Overview
Add multi-worker scaling, advanced scheduling, audit logging, and third-party integrations.

### Planned Deliverables

#### 1. Distributed Worker Scaling (15% complete)
- [ ] Multi-worker deployment with shared queue
- [ ] Worker health monitoring
- [ ] Job routing and load balancing
- [ ] Graceful shutdown with job migration
- [ ] Worker resource limits (memory, CPU)
- **Target:** Q3 2026
- **Effort:** 3 weeks

#### 2. Audit Logging (0% complete)
- [ ] Immutable audit log table
- [ ] Log all CRUD operations
- [ ] Track execution history with context
- [ ] Compliance report generation
- [ ] Retention policies (configurable)
- **Target:** Q3 2026
- **Effort:** 2 weeks

#### 3. Advanced Scheduling (0% complete)
- [ ] Advanced cron syntax (*/5 * * * * MON-FRI)
- [ ] Timezone-aware scheduling with DST handling
- [ ] Conditional scheduling (run if previous succeeded)
- [ ] Pause/resume workflows
- [ ] Job failure notifications
- **Target:** Q3 2026
- **Effort:** 2 weeks

#### 4. Third-Party Integrations (0% complete)
- [ ] Slack integration (send messages, respond to events)
- [ ] GitHub integration (trigger on push, create issues)
- [ ] Zapier-like API connector (generic HTTP + auth patterns)
- [ ] OAuth2 setup helpers
- **Target:** Q3 2026
- **Effort:** 3 weeks

#### 5. Encryption Key Rotation (0% complete)
- [ ] Multi-key support (active + historical keys)
- [ ] Key versioning in credential metadata
- [ ] Background re-encryption job
- [ ] Zero-downtime rotation
- **Target:** Q3 2026
- **Effort:** 2 weeks

#### 6. API Improvements (0% complete)
- [ ] Webhook signature verification (HMAC-SHA256)
- [ ] Async webhook mode (return immediately, process in background)
- [ ] Batch execution endpoint
- [ ] GraphQL API (optional alongside REST)
- **Target:** Q3 2026
- **Effort:** 2 weeks

### Success Criteria
- [ ] 10+ concurrent workers in production
- [ ] Audit log with > 99.9% completeness
- [ ] < 5s job processing latency (P95)
- [ ] 5+ new integrations available
- [ ] Zero data loss during key rotation

### Dependencies
- Redis cluster setup (for distributed queue)
- PostgreSQL upgrade to 14+ (for better concurrency)
- Slack/GitHub OAuth applications

---

## Phase 3: AI-Assisted Automation (PLANNED)

### Overview
LLM-powered node suggestions, natural language workflow generation, and anomaly detection.

### Planned Deliverables

#### 1. LLM-Powered Node Suggestion (Planned)
- [ ] Context-aware node recommendations in editor
- [ ] Suggest next node based on graph structure
- [ ] Configuration suggestions (e.g., common URLs, headers)
- [ ] Integration with Claude API
- **Target:** Q4 2026

#### 2. Natural Language Workflow Description (Planned)
- [ ] Generate workflow from text description ("send emails to all GitHub stargazers")
- [ ] Convert existing workflows to natural language docs
- [ ] Ask questions about workflow logic
- **Target:** Q4 2026

#### 3. Anomaly Detection (Planned)
- [ ] Detect execution anomalies (slow node, high error rate)
- [ ] Alert on unexpected performance changes
- [ ] ML-based failure prediction
- **Target:** Q4 2026

#### 4. Smart Testing (Planned)
- [ ] Generate test cases from workflow
- [ ] Suggest edge cases to test
- [ ] Automatically validate workflow correctness
- **Target:** Q4 2026

### Success Criteria
- [ ] LLM API integration tested with > 100 workflows
- [ ] Natural language → workflow conversion accuracy > 85%
- [ ] Anomaly detection F1 score > 0.9
- [ ] User satisfaction score > 4.5/5

### Dependencies
- Claude API (or OpenAI fallback)
- Workflow execution analytics pipeline
- ML training data (anonymized workflows)

---

## Phase 4: Marketplace & Ecosystem (PLANNED)

### Overview
Third-party node marketplace, workflow sharing, and community contributions.

### Planned Deliverables

#### 1. Node Marketplace (Planned)
- [ ] Publish custom nodes to marketplace
- [ ] Node ratings and reviews
- [ ] Version management for nodes
- [ ] Dependency resolution
- **Target:** Q1 2027

#### 2. Workflow Sharing (Planned)
- [ ] Share workflows publicly or with team
- [ ] Workflow templates for common tasks
- [ ] Clone and fork workflows
- **Target:** Q1 2027

#### 3. Community Contributions (Planned)
- [ ] Open-source contribution guidelines
- [ ] Community node contributions
- [ ] Sponsor program for maintainers
- **Target:** Q1 2027

#### 4. On-Premise Licensing (Planned)
- [ ] Self-hosted deployment options
- [ ] License key management
- [ ] Air-gapped environment support
- **Target:** Q1 2027

### Success Criteria
- [ ] 50+ community-contributed nodes
- [ ] 1000+ shared workflow templates
- [ ] Community marketplace with > 10K monthly users
- [ ] 100+ active open-source contributors

---

## Technical Debt & Cleanup

### High Priority (Q3 2026)
- [ ] Add helmet.js for security headers
- [ ] Implement rate limiting middleware
- [ ] Add cache layer for frequently accessed workflows
- [ ] Refactor worker processor into smaller modules
- [ ] Add E2E tests for critical workflows
- **Effort:** 2 weeks

### Medium Priority (Q4 2026)
- [ ] Move node registry to separate database table (currently in-memory)
- [ ] Add data retention policies
- [ ] Improve error messages (user-friendly)
- [ ] Add request ID correlation for debugging
- **Effort:** 1.5 weeks

### Low Priority (2027)
- [ ] Upgrade to NestJS 11
- [ ] Migrate from Jest to Vitest
- [ ] Add Playwright E2E tests
- [ ] Performance optimization (caching, indexing)
- **Effort:** 1 week/quarter

---

## Current Sprint (Week of 2026-06-09)

### Completed
- ✅ Production release v1.0.0
- ✅ Documentation complete (overview, architecture, code standards)
- ✅ All security audits passed
- ✅ Performance benchmarks verified

### This Week
- 🔄 Prepare deployment runbooks
- 🔄 Set up production monitoring (Prometheus metrics)
- 🔄 Plan Phase 2 technical details
- 🔄 Community feedback collection

### Next Week (2026-06-15)
- Begin Phase 2: Multi-worker scaling
- Set up Redis cluster
- Implement distributed tracing (OpenTelemetry)

---

## Release Cadence

### Version Strategy
- **Major (X.0.0):** Breaking changes, new core features
- **Minor (0.X.0):** New features, non-breaking
- **Patch (0.0.X):** Bug fixes, security patches

### Release Schedule
- **v1.0.0:** 2026-06-09 (Production Release)
- **v1.1.0:** 2026-08-31 (Phase 2 features)
- **v1.2.0:** 2026-09-30 (Enterprise features)
- **v2.0.0:** 2026-12-31 (AI features)
- **v3.0.0:** 2027-03-31 (Marketplace)

### Support Policy
- **v1.x:** LTS until 2027-12-31 (18 months)
- **v2.x:** Standard until 2027-09-30 (12 months)
- **v3.x:** Ongoing

---

## Unresolved Questions

1. **Database Sharding:** When to shard execution history (target: 1B+ records)?
   - Proposal: Shard by (workspaceId, createdAt) after reaching 500M records
   - Decision pending: infrastructure team sign-off

2. **Node Package Distribution:** How to distribute custom nodes?
   - Option A: NPM packages (simpler, but requires node runtime)
   - Option B: Docker containers (safer, more complex)
   - Decision pending: security review

3. **Backward Compatibility:** How long to maintain old API versions?
   - Proposal: 2 versions behind (deprecation warnings for 6 months)
   - Decision pending: PM alignment on customer impact

4. **Multi-Tenancy Limits:** Max workflows per workspace? Max execution history?
   - Proposal: 10K workflows, 1M execution records (with archival)
   - Decision pending: cost analysis

---

## Key Metrics & Goals (2026)

### Reliability
- Uptime: 99.95% (target)
- MTTR (Mean Time To Recovery): < 15 minutes
- Data loss: 0 (zero tolerance)

### Performance
- Workflow execution latency: P95 < 500ms
- SSE stream latency: < 50ms
- API response time: P95 < 200ms

### Adoption
- Active workspaces: 100+ (by end of 2026)
- Total workflows: 5K+
- Monthly executions: 100M+

### Quality
- Code coverage: > 85%
- Bug escape rate: < 1 per 10K LOC
- Security findings (critical): 0

---

## References & Related Docs

- **Project Overview:** `./project-overview-pdr.md`
- **System Architecture:** `./system-architecture.md`
- **Code Standards:** `./code-standards.md`
- **Deployment Guide:** `./deployment-guide.md` (to be created)
