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

**Full dev environment** (recommended — starts FDR server + all infrastructure including both parsers):
```bash
pnpm fdr:dev
```

**Parser only** (for testing the parser in isolation without the full stack):
```bash
cd servers/fdr && docker compose -f docker-compose.dev.yml up -d --build cpp-library-docs-parser s3-mock
```

**Invoke the Lambda handler directly:**
```bash
curl -s -X POST "http://localhost:9002/2015-03-31/functions/function/invocations" \
  -d '{"jobId":"test-cpp","githubUrl":"https://github.com/NVIDIA/cccl","language":"CPP"}'

# Expected response: {"status": "success", "irS3Key": "library-docs-ir/test-cpp.json"}
```

The FDR server is pre-configured to reach this parser at `http://localhost:9002` via env vars in `servers/fdr/.env.local.dev`. The Python parser runs on port 9001 with the same setup.

## Reference
- Mirrors: `servers/fdr-python-library-docs-parser/`
- Plan: `servers/fdr/src/services/library-docs/CPP-LIBRARY-DOCS-PLAN.md`
- Linear project: "C++ Library Documentation"
