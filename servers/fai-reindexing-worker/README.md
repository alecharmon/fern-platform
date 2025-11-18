# FAI Reindexing Worker

A Node.js service that polls an SQS queue for documentation reindexing jobs and processes them by updating the Turbopuffer search index and syncing with the FAI query index.

## Architecture

This worker service runs as a separate ECS Fargate container alongside the main FAI Python service. It:

1. **Polls SQS queue** for reindexing job messages
2. **Fetches documentation data** from FDR (Fern Definition Registry)
3. **Creates and vectorizes** search records using OpenAI embeddings
4. **Upserts to Turbopuffer** (vector database)
5. **Syncs to FAI query index** for production search
6. **Tracks job status** in Vercel KV

## Message Format

The worker expects SQS messages with the following JSON structure:

```json
{
  "domain": "docs.example.com",
  "deleteExisting": true
}
```

- `domain` (required): The documentation domain to reindex
- `deleteExisting` (optional): Whether to delete existing records before upserting (default: `true`)

## Environment Variables

Required environment variables:

```bash
# AWS
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/reindexing-queue

# Search & AI
TURBOPUFFER_API_KEY=your_turbopuffer_api_key
OPENAI_API_KEY=your_openai_api_key

# Fern Services
FERN_TOKEN=your_fern_admin_token
FDR_ENVIRONMENT=production
FAI_ORIGIN=https://fai.buildwithfern.com
FDR_ORIGIN=https://registry.buildwithfern.com

# Configuration
FERN_DOCS_INDEX_NAME=fern-docs

# Vercel KV (for job status tracking)
KV_URL=your_vercel_kv_url
KV_REST_API_URL=your_vercel_kv_rest_api_url
KV_REST_API_TOKEN=your_vercel_kv_rest_api_token
KV_REST_API_READ_ONLY_TOKEN=your_vercel_kv_read_only_token
```

## Local Development

### Prerequisites

- Node.js 22+
- pnpm 10.11.0
- Docker (for local testing)

### Setup

```bash
# Install dependencies
pnpm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your credentials

# Run in development mode
pnpm dev

# Build TypeScript
pnpm build

# Start production build
pnpm start
```

### Testing with Local SQS

You can use [LocalStack](https://localstack.cloud/) to test SQS integration locally:

```bash
# Start LocalStack
docker run -d -p 4566:4566 localstack/localstack

# Create a test queue
aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name reindexing-queue

# Send a test message
aws --endpoint-url=http://localhost:4566 sqs send-message \
  --queue-url http://localhost:4566/000000000000/reindexing-queue \
  --message-body '{"domain":"docs.buildwithfern.com"}'

# Update .env to point to local queue
SQS_QUEUE_URL=http://localhost:4566/000000000000/reindexing-queue
```

## Deployment

The worker is deployed automatically with the FAI service when you push a tag:

```bash
# Tag a new release
git tag fai@1.2.3
git push origin fai@1.2.3
```

The deployment workflow (`.github/workflows/deploy-fai.yml`) will:

1. Build the FAI Python service Docker image
2. Build the FAI reindexing worker Docker image
3. Deploy both services to ECS using AWS CDK

### Manual Deployment

```bash
# Build Docker image
docker build -t fai-reindexing-worker:latest -f Dockerfile ../../

# Save as tarball (for CDK deployment)
docker save fai-reindexing-worker:latest -o fai-reindexing-worker.tar

# Deploy with CDK
cd ../fai/deploy
pnpm install
VERSION="1.2.3" SQS_QUEUE_URL="your-queue-url" pnpm cdk deploy fai-prod
```

## Infrastructure

The worker is defined in the FAI deploy stack (`servers/fai/deploy/src/deploy-stack.ts`) with:

- **CPU**: 512 (0.5 vCPU)
- **Memory**: 2048 MB (2 GB)
- **Desired Count**: 1 (single instance)
- **Networking**: Public IP for external API access
- **IAM Permissions**:
  - SQS: ReceiveMessage, DeleteMessage, GetQueueAttributes, ChangeMessageVisibility
  - Lambda: InvokeFunction (for code indexing)

## Monitoring

### CloudWatch Logs

Logs are sent to CloudWatch Logs under the log group defined in the FAI stack with stream prefix `fai-reindexing-worker`.

Example log queries:

```sql
# Find failed reindex jobs
fields @timestamp, @message
| filter @message like /Reindex failed/
| sort @timestamp desc
| limit 20

# Track reindex duration
fields @timestamp, domain, duration_ms
| filter @message like /Reindex completed/
| sort @timestamp desc
```

### Job Status in KV

Job status is tracked in Vercel KV under the domain key:

```typescript
// Get job status
const jobStatus = await kv.hget(domain, "tpuf_job");

// Example status object
{
  status: "completed" | "in_progress" | "failed",
  started_at: "2025-01-15T10:30:00.000Z",
  completed_at: "2025-01-15T10:35:00.000Z",
  duration_ms: 300000,
  num_inserted: 1234,
  job_id: "abc123",
  error: "error message (if failed)"
}
```

## Error Handling

The worker implements the following error handling strategies:

1. **Message Visibility Timeout**: 15 minutes (900 seconds)
   - If processing fails, the message becomes visible again after 15 minutes
   - Configure a dead letter queue (DLQ) for repeated failures

2. **Polling Retry**: 5 second backoff on SQS polling errors

3. **Job Status Tracking**: Failed jobs are marked in KV with error details

4. **Graceful Degradation**:
   - Skips preview domains without Algolia enabled
   - Skips domains where Ask AI is disabled
   - Validates domain existence before processing

## Triggering Reindex Jobs

### From Code

```typescript
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({ region: "us-east-1" });

await sqs.send(new SendMessageCommand({
  QueueUrl: process.env.SQS_QUEUE_URL,
  MessageBody: JSON.stringify({
    domain: "docs.example.com",
    deleteExisting: true
  })
}));
```

### From AWS Console

1. Navigate to SQS in AWS Console
2. Select the `fai-reindexing-*` queue
3. Click "Send and receive messages"
4. Enter message body:
   ```json
   {"domain": "docs.example.com"}
   ```
5. Click "Send message"

### From CLI

```bash
aws sqs send-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/123456789/fai-reindexing-prod \
  --message-body '{"domain":"docs.example.com"}'
```

## Future Improvements

- [ ] Add metrics/Prometheus instrumentation
- [ ] Implement exponential backoff for failed jobs
- [ ] Add support for batch processing multiple domains
- [ ] Implement circuit breaker for external API calls
- [ ] Add health check endpoint for ECS health monitoring
- [ ] Support incremental indexing (only changed docs)
- [ ] Add progress tracking for long-running jobs
