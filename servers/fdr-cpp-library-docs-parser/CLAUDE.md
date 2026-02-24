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
  project_detector.py  # Detect C++ project structure (headers, CUDA files)
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

## Reference
- Mirrors: `servers/fdr-python-library-docs-parser/`
- Plan: `servers/fdr/src/services/library-docs/CPP-LIBRARY-DOCS-PLAN.md`
- Linear project: "C++ Library Documentation"
