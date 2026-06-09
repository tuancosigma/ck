# Deployment Guide

**Version:** 1.0.0  
**Last Updated:** 2026-06-09  
**Environments:** Development, Staging, Production

---

## Pre-Deployment Checklist

- [ ] All tests passing (`npm test`)
- [ ] Code coverage > 80% (`npm run test:coverage`)
- [ ] Security audit clean (`npm run security:audit`)
- [ ] Environment variables configured (`.env.production`)
- [ ] Database backups verified
- [ ] Redis cluster/instance available
- [ ] SSL certificates valid
- [ ] Monitoring configured (Prometheus, logs)

---

## Environment Setup

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/n8n_production

# Redis Queue
REDIS_URL=redis://user:password@host:6379

# Authentication
JWT_SECRET=<32+ character random string, e.g., from `openssl rand -base64 32`>

# Encryption
ENCRYPTION_KEY=<32-byte base64 string, e.g., from `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`>

# Application
NODE_ENV=production
LOG_LEVEL=info
PORT=3000

# Optional: Monitoring
PROMETHEUS_PORT=9090
OTEL_COLLECTOR_URL=http://otel-collector:4317

# Optional: Integrations (Phase 2)
SLACK_BOT_TOKEN=xoxb-...
GITHUB_PAT=ghp_...
```

### Generate Secure Values

```bash
# Generate JWT_SECRET
openssl rand -base64 32

# Generate ENCRYPTION_KEY (32 bytes base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Generate bcrypt salt (internal, automatic via bcrypt)
# No manual generation needed
```

---

## Development Environment

### Local Setup

```bash
# 1. Clone repository
git clone <repo-url>
cd n8n

# 2. Install dependencies
npm install

# 3. Set up local .env
cp apps/api/.env.example apps/api/.env.development
# Edit .env.development with local database/redis URLs

# 4. Start PostgreSQL & Redis (Docker)
docker run -d --name postgres -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:15
docker run -d --name redis -p 6379:6379 redis:7

# 5. Initialize database
npm run prisma:generate -w api
npm run prisma:migrate -w api

# 6. Run development servers
npm run dev -w api     # Terminal 1
npm run dev -w web     # Terminal 2

# 7. Access application
# Frontend: http://localhost:3000
# API: http://localhost:3001
# Swagger: http://localhost:3001/api/docs (when enabled)
```

### Local Testing

```bash
# Run all tests
npm test

# Watch mode for development
npm test -- --watch

# Coverage report
npm test -- --coverage

# Specific test file
npm test -w api -- workflows.service.spec.ts
```

---

## Staging Environment

### Staging Deployment

```bash
# 1. Build all packages
npm run build

# 2. Tag release
git tag v1.0.0
git push origin v1.0.0

# 3. Deploy to staging
# Using Docker Compose or Kubernetes manifest
docker-compose -f docker-compose.staging.yml up -d

# 4. Run migrations
npm run prisma:migrate -w api

# 5. Verify deployment
curl http://staging-api.example.com/health
curl http://staging-web.example.com/

# 6. Run smoke tests
npm run test:e2e:staging
```

### Staging Monitoring

```bash
# Check logs
docker logs -f api_staging

# Check database
psql -h staging-db.example.com -U app -d n8n

# Check Redis
redis-cli -h staging-redis.example.com ping

# Prometheus metrics
curl http://staging-api.example.com:9090/metrics
```

---

## Production Deployment

### Pre-Production Validation

```bash
# 1. Run full test suite
npm test -- --bail

# 2. Build production image
docker build -t n8n:1.0.0 .

# 3. Security scan
docker scan n8n:1.0.0

# 4. Performance test
npm run test:performance

# 5. Load test
npm run test:load -- --concurrent 100
```

### Production Rollout Strategy

#### Option 1: Blue-Green Deployment (Recommended)

```bash
# 1. Spin up new environment (green)
kubectl apply -f deploy/green-stack.yml

# 2. Verify health checks
kubectl wait --for=condition=ready pod -l version=green

# 3. Run smoke tests
./scripts/smoke-tests.sh green

# 4. Switch traffic (blue → green)
kubectl patch service api -p '{"spec": {"selector": {"version": "green"}}}'

# 5. Monitor for 30 minutes
watch -n 5 'kubectl logs -l version=green | tail -20'

# 6. Clean up old environment (blue)
kubectl delete deployment api-blue

# 7. Scale if needed
kubectl scale deployment api-green --replicas=5
```

#### Option 2: Rolling Update (Gradual)

```bash
# 1. Update image reference
kubectl set image deployment/api api=n8n:1.0.0

# 2. Monitor rollout
kubectl rollout status deployment/api

# 3. Automatic health checks ensure old pods drain gracefully
kubectl set env deployment/api GRACEFUL_SHUTDOWN=30s
```

### Production Kubernetes Manifests

```yaml
# deploy/api-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: production
spec:
  replicas: 5
  selector:
    matchLabels:
      app: api
      version: v1
  template:
    metadata:
      labels:
        app: api
        version: v1
    spec:
      serviceAccountName: api
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
      containers:
      - name: api
        image: n8n:1.0.0
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
          name: http
        - containerPort: 9090
          name: metrics
        env:
        - name: NODE_ENV
          value: "production"
        - name: LOG_LEVEL
          value: "info"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: api-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: api-secrets
              key: redis-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: api-secrets
              key: jwt-secret
        - name: ENCRYPTION_KEY
          valueFrom:
            secretKeyRef:
              name: api-secrets
              key: encryption-key
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 2000m
            memory: 2Gi
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 30"]

---
apiVersion: v1
kind: Service
metadata:
  name: api-service
  namespace: production
spec:
  type: LoadBalancer
  selector:
    app: api
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 5
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Database Migration in Production

```bash
# 1. Create backup
pg_dump postgresql://user:pass@prod-db:5432/n8n > backup_pre_migration.sql

# 2. Run migration in dry-run mode
npx prisma migrate deploy --skip-generate --skip-validate --dry-run

# 3. Run actual migration
npx prisma migrate deploy

# 4. Verify schema
psql -c "SELECT version, name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;"

# 5. Monitor application
# Watch logs for any schema-related errors
kubectl logs -f deployment/api | grep -i "migration\|error"
```

---

## Worker Deployment

### Single-Worker Setup (Development/Staging)

```bash
# Worker runs in same process as API
# No additional setup needed
npm start -w api
```

### Multi-Worker Setup (Production)

```bash
# Option 1: Separate Kubernetes Pods
kubectl apply -f deploy/worker-deployment.yml

---
# deploy/worker-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker
  namespace: production
spec:
  replicas: 10  # 10 workers for ~1000 jobs/sec throughput
  selector:
    matchLabels:
      app: worker
  template:
    metadata:
      labels:
        app: worker
    spec:
      containers:
      - name: worker
        image: n8n:1.0.0
        env:
        - name: WORKER_MODE
          value: "true"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: api-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: api-secrets
              key: redis-url
        resources:
          requests:
            cpu: 1000m
            memory: 1Gi
          limits:
            cpu: 2000m
            memory: 2Gi
---

# Option 2: Docker Compose (Staging/Small Production)
docker-compose -f docker-compose.prod.yml up -d

# Scale workers
docker-compose -f docker-compose.prod.yml up -d --scale worker=10
```

---

## Monitoring & Observability

### Health Checks

```bash
# Liveness probe (is service running?)
curl http://api:3000/health

# Readiness probe (can handle requests?)
curl http://api:3000/health/ready

# Deep health check
curl http://api:3000/health/deep
# Returns: {database: OK, redis: OK, workers: OK}
```

### Logging

```bash
# View structured logs (production)
kubectl logs -f deployment/api | jq '.level, .msg'

# Filter by context
kubectl logs deployment/api | jq 'select(.context == "execution_123")'

# Alert on errors
kubectl logs deployment/api | grep '"level":"error"'
```

### Metrics (Prometheus)

```bash
# Endpoint
curl http://api:3000/metrics

# Common metrics
# http_request_duration_seconds
# db_query_duration_seconds
# job_processing_duration_seconds
# credential_encrypt_duration_seconds

# Prometheus scrape config
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'api'
    static_configs:
      - targets: ['api:9090']
  - job_name: 'workers'
    static_configs:
      - targets: ['worker-1:9090', 'worker-2:9090', ...]
```

### Alerting Rules

```yaml
# alerts.yml
groups:
- name: n8n
  rules:
  - alert: APIHighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
    for: 5m
    annotations:
      summary: "High error rate on API"

  - alert: WorkerQueueBacklog
    expr: bullmq_queue_waiting_count > 10000
    for: 10m
    annotations:
      summary: "Job queue backlog exceeding threshold"

  - alert: DatabaseConnectionPoolExhausted
    expr: db_connection_pool_available == 0
    for: 1m
    annotations:
      summary: "Database connection pool exhausted"

  - alert: HighMemoryUsage
    expr: container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.9
    for: 5m
    annotations:
      summary: "Memory usage above 90%"
```

---

## Scaling Guide

### Horizontal Scaling (Add More Pods)

```bash
# Scale API instances (handles HTTP requests)
kubectl scale deployment api --replicas=10

# Scale workers (handles job execution)
kubectl scale deployment worker --replicas=20

# Monitor scaling
kubectl get hpa api-hpa -w

# Auto-scaling is configured via HPA (see manifests above)
```

### Vertical Scaling (Larger Pods)

```yaml
# Increase resource limits
resources:
  requests:
    cpu: 2000m         # Was 500m
    memory: 2Gi        # Was 512Mi
  limits:
    cpu: 4000m         # Was 2000m
    memory: 4Gi        # Was 2Gi
```

### Database Scaling

```bash
# Connection pool tuning
DATABASE_URL=postgresql://...?sslmode=require&schema=public&connection_limit=50

# Read replicas (Phase 2)
# - Read-only executions list from replica
# - Writes to primary (automatic replication)

# Sharding (Phase 2)
# - Shard execution history by (workspaceId, createdAt)
# - Shard credentials by workspaceId
```

### Redis Scaling

```bash
# Cluster mode (automatic failover)
redis-cluster create node-1:6379 node-2:6379 ... node-6:6379

# Update REDIS_URL
REDIS_URL=redis://node-1:6379,node-2:6379,...

# BullMQ automatically uses cluster for failover
```

---

## Disaster Recovery

### Backup Strategy

```bash
# Daily PostgreSQL backups (automated)
0 1 * * * pg_dump postgresql://user:pass@prod-db:5432/n8n | gzip > /backup/n8n_$(date +\%Y\%m\%d).sql.gz

# Retain 30 days of backups
find /backup -name "n8n_*.sql.gz" -mtime +30 -delete

# Store backups in S3
aws s3 sync /backup s3://n8n-backups/

# Test restore process monthly
./scripts/test-restore.sh backup_20260609.sql.gz
```

### Recovery Procedures

#### Scenario 1: Database Corruption

```bash
# 1. Stop application
kubectl scale deployment api --replicas=0
kubectl scale deployment worker --replicas=0

# 2. Restore from backup
pg_restore -d n8n < backup_20260609.sql.gz

# 3. Restart application
kubectl scale deployment api --replicas=5
kubectl scale deployment worker --replicas=10

# 4. Verify data integrity
npm run prisma:validate -w api

# 5. Monitor for anomalies
kubectl logs -f deployment/api | grep -i "error\|migration"
```

#### Scenario 2: Data Loss (Accidental Deletion)

```bash
# 1. Restore to point-in-time (PostgreSQL PITR)
# Configure WAL archiving first:
# wal_level = replica
# archive_mode = on
# archive_command = 'cp %p /pg_wal_archive/%f'

# 2. Restore database to specific timestamp
pg_basebackup -D /var/lib/postgresql/data -R
# Edit recovery.conf: recovery_target_timeline = 'latest'

# 3. Restart PostgreSQL at desired recovery point
systemctl restart postgresql

# 4. Application recovery steps (same as above)
```

#### Scenario 3: Redis Queue Corruption

```bash
# 1. Redis stores only transient job data (non-critical)
# Jobs can be re-triggered manually if needed

# 2. Flush Redis and restart
redis-cli FLUSHALL
# Lost jobs will need to be re-triggered by users

# 3. Consider using Redis persistence for critical jobs
# Update redis.conf:
# appendonly yes
# appendfsync everysec
```

---

## Rollback Procedure

```bash
# 1. Identify last stable version
kubectl rollout history deployment/api

# 2. Trigger rollback
kubectl rollout undo deployment/api --to-revision=5

# 3. Monitor rollout
kubectl rollout status deployment/api

# 4. Verify functionality
curl http://api:3000/health
./scripts/smoke-tests.sh

# 5. Investigate failure
# Collect logs and metrics from failed deployment
kubectl logs deployment/api-blue > /tmp/api-logs.txt
kubectl describe deployment api-blue > /tmp/api-status.txt
```

---

## Security Checklist (Production)

- [ ] HTTPS/TLS enabled (certificate from Let's Encrypt or CA)
- [ ] All environment variables from secrets manager (not .env files)
- [ ] Database password changed from default
- [ ] Redis password configured and encrypted
- [ ] JWT_SECRET and ENCRYPTION_KEY rotated (different from staging)
- [ ] Network policies restrict inter-pod communication
- [ ] Container image scanned for vulnerabilities
- [ ] Logs aggregated and monitored for suspicious activity
- [ ] Database backups encrypted and stored securely
- [ ] Regular security audits scheduled (quarterly)

---

## Maintenance Windows

### Database Maintenance

```bash
# Weekly vacuum and analyze (optional, auto-runs in Postgres 14+)
0 3 * * 0 psql -c "VACUUM ANALYZE;" > /var/log/vacuum.log

# Monthly index maintenance
# Run during off-peak hours (after smoke tests, before peak usage)
```

### Cache Cleanup (Optional)

```bash
# Clear expired sessions (TTL handled by Redis automatically)
redis-cli FLUSHDB ASYNC  # Only if needed

# Monitor cache hit rate
redis-cli INFO stats | grep hits
```

### Version Upgrades

```bash
# Test in staging first (2 weeks before production)
npm outdated
npm update --save

# Run full test suite
npm test

# Benchmark performance
npm run test:performance

# Deploy to staging
# Verify for 2 weeks
# Then deploy to production (during low-traffic window)
```

---

## Support & Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Jobs stuck in queue | Worker crashed | Scale up workers, check logs |
| High latency | Database slow | Check query performance, add indexes |
| OOM (Out of Memory) | Memory leak | Restart pods, increase limits |
| Credential decryption failed | Wrong ENCRYPTION_KEY | Verify env var, check backup |
| Webhooks not firing | Redis connection lost | Restart Redis, check network |

### Getting Help

```bash
# Collect diagnostic info
./scripts/diagnostics.sh > diag_report.txt

# Includes:
# - Pod logs (last 1000 lines)
# - Resource usage
# - Database connection status
# - Redis status
# - Pending jobs count
# - Error rate metrics
```

---

## References

- **System Architecture:** `./system-architecture.md`
- **Code Standards:** `./code-standards.md`
- **Development Roadmap:** `./development-roadmap.md`
- **Project Overview:** `./project-overview-pdr.md`
- **Kubernetes Docs:** https://kubernetes.io/docs
- **Prisma Deployment:** https://www.prisma.io/docs/guides/deployment
- **BullMQ Scaling:** https://docs.bullmq.io/
