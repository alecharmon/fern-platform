# fdr-cpp-library-docs-parser

C++ Library Documentation Parser Lambda. Clones a C++ repo, runs Doxygen, parses XML output, builds IR, uploads to S3.

## Stack
- Python 3.12, Poetry, AWS Lambda
- Dependencies: boto3, lxml, pydantic>=2.0, GitPython
- Dockerfile installs doxygen + git via dnf

## Structure
```
src/
  handler.py           # Lambda entrypoint (src.handler.handler)
  git_clone.py         # Shallow clone repo
  s3_client.py         # Upload IR JSON to S3
  project_detector.py  # Detect C++ project structure (headers, sources)
  doxygen_runner.py    # Generate Doxyfile, run doxygen CLI
  generated/           # Auto-generated Python SDK types (via Fern SDK generation)
  extractor/           # Doxygen XML -> IR extractors
tests/
```

## Handler Contract
- Input: `{ jobId, githubUrl, language: "CPP", branch?, packagePath? }`
- Output: `{ status: "success", irS3Key }` or `{ status: "error", error: { code, message } }`
- S3 path: `library-docs-ir/{jobId}.json`

## Commands
```bash
docker build -t fdr-cpp-library-docs-parser .
poetry install
poetry run pytest
```

## Local Testing

The C++ parser runs as a Docker container in the `pnpm fdr:dev` environment (port 9002).
S3 mock (Adobe S3Mock) runs on port 9090 with a pre-created `fdr` bucket.

### 1. Start containers

**Full dev environment** (starts FDR server + all infrastructure including both parsers):
```bash
pnpm fdr:dev
```

**Parser only** (for testing the parser in isolation without the full stack):
```bash
cd servers/fdr && docker compose -f docker-compose.dev.yml up -d --build cpp-library-docs-parser s3-mock
```

Verify containers are running:
```bash
cd servers/fdr && docker compose -f docker-compose.dev.yml ps cpp-library-docs-parser s3-mock
```

### 2. Invoke the Lambda

```bash
curl -s -X POST "http://localhost:9002/2015-03-31/functions/function/invocations" \
  -d '{"jobId":"test-cccl-thrust","githubUrl":"https://github.com/NVIDIA/cccl","language":"CPP","packagePath":"thrust"}'
```

Expected response:
```json
{"status": "success", "irS3Key": "library-docs-ir/test-cccl-thrust.json"}
```

**Note**: This takes several minutes (large repo clone + Doxygen run).

### 3. Fetch the IR from S3 mock

```bash
# Pretty-print first 100 lines
curl -s "http://localhost:9090/fdr/library-docs-ir/test-cccl-thrust.json" | python3 -m json.tool | head -100

# Check IR size
curl -s "http://localhost:9090/fdr/library-docs-ir/test-cccl-thrust.json" | wc -c

# Inspect IR structure and entity counts
curl -s "http://localhost:9090/fdr/library-docs-ir/test-cccl-thrust.json" | python3 -c "
import json, sys
data = json.load(sys.stdin)
print('Top-level keys:', list(data.keys()))
if 'metadata' in data:
    print('Metadata:', json.dumps(data['metadata'], indent=2))
if 'ir' in data:
    ir = data['ir']
    print('IR keys:', list(ir.keys()))
"
```

S3 mock uses path-style URLs: `http://localhost:9090/{bucket}/{key}`

### 4. Cleanup

```bash
cd servers/fdr && docker compose -f docker-compose.dev.yml stop cpp-library-docs-parser s3-mock
```

### Quick smoke test (small fixture, faster)

For a faster smoke test, use a smaller repo:
```bash
curl -s -X POST "http://localhost:9002/2015-03-31/functions/function/invocations" \
  -d '{"jobId":"test-small","githubUrl":"https://github.com/fmtlib/fmt","language":"CPP","packagePath":"include/fmt"}'
```

### Full-stack E2E test (FDR server + Lambda + S3)

This tests the full flow: FDR API → Lambda invocation → S3 upload → presigned URL.

**1. Start Docker services:**
```bash
cd servers/fdr && docker compose -f docker-compose.dev.yml up -d --build
```

**2. Run DB migrations:**
```bash
cd servers/fdr && DATABASE_URL="postgresql://fdr:fdr1!@localhost:5432/fdr?schema=public" npx prisma migrate deploy
```

**3. Start FDR server** (must omit VENUS_URL for local auth to work):
```bash
cd servers/fdr && \
LOCAL_MODE_OVERRIDE=true \
DATABASE_URL="postgresql://fdr:fdr1!@localhost:5432/fdr?schema=public" \
S3_ACCESS_KEY=minioadmin \
S3_SECRET_KEY=minioadmin \
S3_ENDPOINT=http://localhost:9090 \
S3_BUCKET_NAME=fdr \
S3_FORCE_PATH_STYLE=true \
AWS_ACCESS_KEY_ID=test \
AWS_SECRET_ACCESS_KEY=test \
CPP_LIBRARY_DOCS_LAMBDA_FUNCTION_NAME=function \
CPP_LIBRARY_DOCS_LAMBDA_REGION=us-east-1 \
CPP_LIBRARY_DOCS_LAMBDA_ENDPOINT=http://localhost:9002 \
PYTHON_LIBRARY_DOCS_LAMBDA_FUNCTION_NAME=function \
PYTHON_LIBRARY_DOCS_LAMBDA_REGION=us-east-1 \
PYTHON_LIBRARY_DOCS_LAMBDA_ENDPOINT=http://localhost:9001 \
LOG_LEVEL=info \
npx tsx src/server.ts
```

**4. Call the generation API:**
```bash
# Start generation
curl -s -X POST http://localhost:8080/v2/registry/docs/library-docs/generate \
  -H "Content-Type: application/json" \
  -d '{"orgId":"test-org","githubUrl":"https://github.com/fmtlib/fmt","language":"CPP","config":{"packagePath":"include/fmt"}}'
# Returns: {"jobId":"libdocs_..."}

# Poll status (replace jobId)
curl -s "http://localhost:8080/v2/registry/docs/library-docs/status/{jobId}"
# Returns: {"jobId":"...","status":"COMPLETED","progress":"Library IR generated successfully",...}

# Get result (presigned S3 URL)
curl -s "http://localhost:8080/v2/registry/docs/library-docs/result/{jobId}"
# Returns: {"jobId":"...","resultUrl":"http://localhost:9090/fdr/library-docs-ir/..."}

# Download IR
curl -s "<resultUrl>" | python3 -m json.tool | head -100
```

**Note**: The `.env.local.dev` file has `MINIO_*` vars but `FdrConfig.ts` expects `S3_*` vars. The manual env vars above handle this. Also, `VENUS_URL` must NOT be set — it causes 401s since Venus isn't running locally.

### Environment

| Service | Port | Purpose |
|---------|------|---------|
| FDR server | 8080 | API server (run manually via tsx) |
| cpp-library-docs-parser | 9002 | Lambda RIE (C++ parser) |
| python-library-docs-parser | 9001 | Lambda RIE (Python parser) |
| s3-mock | 9090 | Adobe S3Mock (HTTP) |
| s3-mock | 9191 | Adobe S3Mock (HTTPS) |
| fdr-postgres | 5432 | PostgreSQL 16 |
| redis | 6379 | Redis 7 |

## Reference
- Mirrors: `servers/fdr-python-library-docs-parser/`
- Plan: `servers/fdr/src/services/library-docs/CPP-LIBRARY-DOCS-PLAN.md`
- Linear project: "C++ Library Documentation"
