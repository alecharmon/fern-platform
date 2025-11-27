# FAI Reindexing Autoscaler

Dynamic resource allocation system for documentation reindexing with automatic OOM recovery.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          Job Flow                                 │
└──────────────────────────────────────────────────────────────────┘

    SQS Message
    { domain: "acme.docs.com" }
           ↓
    ┌─────────────────────┐
    │   Orchestrator      │  1. Check DynamoDB: job already running?
    │   (ECS Service)     │     YES → Skip (retry in 20min)
    │                     │     NO  → Continue
    │                     │  2. Check override or calculate memory
    │                     │  3. Create job record: status="received"
    └──────────┬──────────┘  4. Launch ECS task
               │             5. Delete SQS message
               ▼
    ┌─────────────────────┐
    │   Worker Task       │  Updates status:
    │   (ECS On-demand)   │  - "batching"  (processing docs)
    │                     │  - "upserting" (to Turbopuffer)
    │                     │  - "syncing"   (to query index)
    └──────────┬──────────┘  - "completed" ✓
               │
               ├─────────────── Success → Done
               │
               └─────────────── OOM (exit 137)
                                      ↓
                          ┌──────────────────────┐
                          │  OOM Recovery Lambda │
                          │  (EventBridge)       │
                          │                      │
                          │  1. retryCount < 3?  │
                          │     YES → +512MB     │
                          │           Requeue    │
                          │     NO  → Mark failed│
                          └──────────────────────┘
```

## Job Tracking (DynamoDB)

**Table**: `fai-reindexing-metadata-table`
**Key**: `domain` (one record per domain)

```typescript
{
  domain: "acme.docs.com",
  status: "completed",        // received | batching | upserting | syncing | completed | failed | oom_retry
  memoryMB: 2560,             // 0 = calculate, >0 = override
  retryCount: 1,              // OOM retry attempts (0-3)
  reason: "OOM recovery: attempt 1, increased from 2048MB to 2560MB",
  taskArn: "arn:...",
  taskArns: ["arn:...1", "arn:...2"],  // History
  startedAt: "2025-01-15T10:00:00Z",
  updatedAt: "2025-01-15T10:05:00Z",
  completedAt: "2025-01-15T10:10:00Z",
  durationMs: 600000,
  numInserted: 1500
}
```

## Key Features

### 1. Dynamic Memory Allocation
- **Formula**: `memoryMB = 0.349 × pages + 0.092 × endpoints + 101`
- **Range**: 512MB - 16GB
- **CPU**: Allocated based on memory (0.5-4 vCPU)

### 2. Memory Overrides
- **Automatic**: OOM recovery increments by +512MB, persists in DynamoDB
- **Manual**: Set `memoryMB` + `reason` in DynamoDB or use `job-tracker` service
- **Detection**: If `memoryMB > 0` AND `reason` exists → use override, else calculate

### 3. Duplicate Prevention
- Checks if job status is `received`, `batching`, `upserting`, `syncing`, or `oom_retry`
- If running: message not deleted → retries after visibility timeout (20min)

### 4. OOM Recovery
- **Max Retries**: 3 attempts
- **Memory Increment**: +512MB per retry
- **After Max**: Status = `failed`, requires manual intervention

## Configuration

### Environment Variables

**Required:**
- `SQS_QUEUE_URL` - Queue for reindex jobs
- `ECS_CLUSTER_NAME` - ECS cluster
- `ECS_EC2_TASK_DEFINITION` - EC2 task definition ARN
- `ECS_FARGATE_TASK_DEFINITION` - Fargate task definition ARN
- `ECS_CAPACITY_PROVIDER` - Capacity provider name
- `ECS_WORKER_CONTAINER_NAME` - Container name
- `ECS_SUBNETS`, `ECS_SECURITY_GROUPS` - Networking
- `TURBOPUFFER_API_KEY`, `OPENAI_API_KEY`, `FERN_TOKEN`

**Optional:**
- `FAI_ORIGIN`, `FDR_ORIGIN`, `FDR_LAMBDA_ORIGIN`
- `POSTHOG_API_KEY`, `ENVIRONMENT`

### SQS Configuration
- **Visibility Timeout**: 1200s (20min)
- **Max Receive Count**: 2 (then → DLQ)

## Deployment

```bash
# Build
pnpm install
pnpm build

# Build Lambda (for OOM recovery)
pnpm build:lambda

# Deploy via CDK
cd deploy
cdk deploy
```

## Monitoring

### CloudWatch Logs Insights

**OOM Recoveries:**
```
fields @timestamp, domain, oldMemoryMB, newMemoryMB, retryCount
| filter @message like /Successfully handled OOM recovery/
| sort @timestamp desc
```

**Jobs with Max Retries:**
```
fields @timestamp, domain, error
| filter @message like /Max retries exceeded/
| sort @timestamp desc
```

### DynamoDB Queries

**All overrides:**
```bash
aws dynamodb scan --table-name fai-reindexing-metadata-table \
  --filter-expression "memoryMB > :zero AND attribute_exists(reason)" \
  --expression-attribute-values '{":zero":{"N":"0"}}'
```

**Specific domain:**
```bash
aws dynamodb get-item --table-name fai-reindexing-metadata-table \
  --key '{"domain":{"S":"acme.docs.com"}}'
```

## Manual Override (Rare)

If automatic recovery fails or manual intervention needed:

```typescript
import { upsertJobRecord } from "./src/services/job-tracker";
import { JobStatus } from "./src/types";

await upsertJobRecord({
  domain: "acme.docs.com",
  status: JobStatus.COMPLETED,
  memoryMB: 3072,
  retryCount: 0,
  reason: "Manual override - customer request"
}, logger);
```

Or via AWS Console → DynamoDB → `fai-reindexing-metadata-table`

## Development

```bash
# Local development
pnpm dev

# Type check
pnpm typecheck

# Build bundle
pnpm build
```

## Service Files

- `src/index.ts` - Orchestrator entrypoint
- `src/worker.ts` - Worker entrypoint
- `src/workers/queue.ts` - SQS polling + delegation
- `src/services/job-tracker.ts` - Unified job tracking
- `src/services/memory-calculator.ts` - Memory calculation
- `src/services/ecs-delegator.ts` - ECS task spawning
- `src/lambda/oom-recovery-handler.ts` - OOM recovery Lambda
- `deploy/src/reindexing-stack.ts` - CDK stack
