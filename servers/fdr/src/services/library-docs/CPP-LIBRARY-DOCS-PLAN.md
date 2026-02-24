# C++ Library Documentation - Implementation Plan (v2)

| Field | Value |
|-------|-------|
| **Author** | Paarth Gupta |
| **Status** | In Progress |
| **Last Updated** | February 2026 |
| **Linear Project** | [C++ Library Documentation](https://linear.app/buildwithfern/project/c-library-documentation-255f25bc73cc) |
| **Target Customer** | NVIDIA CUDA C++ ([NVIDIA/cccl](https://github.com/NVIDIA/cccl)) |
| **Dependencies** | Python library-docs V2 complete |
| **Supersedes** | `CPP-LIBRARY-DOCS-PLAN.md` (two-stage pipeline architecture) |

---

## Context

Add C++ library documentation generation to Fern, targeting NVIDIA CUDA C++ (CCCL). Python V2 is complete and serves as the reference pattern. NVIDIA's Doxygen setup is public so we can validate against real data.

**Key decisions:**
- **Minimal v1:** Single Lambda (like Python), no Step Functions. Split into two stages later only if we hit Lambda limits.
- **oRPC Zod schemas in fdr-sdk** as the single source of truth for C++ IR types. Both server and CLI import from there.
- **MDX generation in CLI** (`fern-api/fern`). FDR only parses and stores IR.

**Why single Lambda over two-stage pipeline (from v1 plan):**
- Python uses a single Lambda and works fine
- We haven't validated that CCCL actually needs the split (Doxygen runtime, XML size)
- No Step Functions = simpler to build, deploy, debug, and test locally
- Same FDR service integration pattern as Python (direct Lambda invoke)
- Known upgrade path to two-stage if we hit limits

---

## Step 1: Scaffold Backend Infrastructure

**Goal:** Get the full skeleton in place — Lambda directory, CDK stack, FDR wiring — with stub implementations. Everything compiles and deploys.

### 1A. Scaffold C++ Lambda

**Create:** `servers/fdr-cpp-library-docs-parser/`

Single Lambda that does everything: clone -> Doxygen -> parse XML -> build IR -> upload to S3. Same pattern as `servers/fdr-python-library-docs-parser/`.

```
servers/fdr-cpp-library-docs-parser/
  Dockerfile                     # Python 3.12 + doxygen + git + lxml
  pyproject.toml                 # Poetry: boto3, lxml, pydantic, GitPython
  src/
    __init__.py
    handler.py                   # Stub: validates input, returns placeholder success
    git_clone.py                 # Stub
    s3_client.py                 # Stub
    project_detector.py          # Stub
    doxygen_runner.py            # Stub
    models/                      # Pydantic models (filled in Step 2)
      __init__.py
    extractor/                   # XML extractors (filled in Step 3)
      __init__.py
  tests/
    __init__.py
```

**Handler contract** (same shape as Python Lambda):
- Input: `{ jobId, githubUrl, language: "CPP", branch?, packagePath? }`
- Output: `{ status: "success", irS3Key }` or `{ status: "error", error: { code, message } }`
- S3 path: `library-docs-ir/{jobId}.json`

**Dockerfile:**
```dockerfile
FROM public.ecr.aws/lambda/python:3.12
RUN dnf install -y doxygen git && dnf clean all
# ... poetry install, copy src
CMD ["src.handler.handler"]
```

**Lambda config:** 4096 MB memory, 15 min timeout, 10 GB ephemeral storage
(Larger than Python since Doxygen + parsing happen in one Lambda)

### 1B. Scaffold CDK Stack

**Create:** `servers/fdr-cpp-library-docs-parser-deploy/`

Mirror `servers/fdr-python-library-docs-parser-deploy/` exactly:
- DockerImageFunction from `../fdr-cpp-library-docs-parser`
- VPC, security group, log group
- S3 PutObject permission for `library-docs-ir/*`
- Environment variable: `LIBRARY_DOCS_S3_BUCKET`

### 1C. Wire FDR Config

**Modify:** `servers/fdr/src/app/FdrConfig.ts`

Add (same pattern as Python Lambda config):
```typescript
const CPP_LIBRARY_DOCS_LAMBDA_FUNCTION_NAME_ENV_VAR = "CPP_LIBRARY_DOCS_LAMBDA_FUNCTION_NAME";
const CPP_LIBRARY_DOCS_LAMBDA_REGION_ENV_VAR = "CPP_LIBRARY_DOCS_LAMBDA_REGION";
const CPP_LIBRARY_DOCS_LAMBDA_ENDPOINT_ENV_VAR = "CPP_LIBRARY_DOCS_LAMBDA_ENDPOINT";

// Add to FdrConfig interface:
cppLibraryDocsLambda?: LambdaConfig;  // Reuses existing LambdaConfig type

// Add getter + wire into getConfig() and getConfigForLocalMode()
```

### 1D. Wire LibraryDocsService for C++

**Modify:** `servers/fdr/src/services/library-docs/LibraryDocsService.ts`

- Add second `LambdaInvoker` for C++ (same class, different config)
- Branch `processJobAsync` on language:
  - `PYTHON` -> `this.pythonLambdaInvoker.invoke(...)` (unchanged)
  - `CPP` -> `this.cppLambdaInvoker.invoke(...)` (same interface, different Lambda)
- No Step Functions, no new AWS clients needed

### 1E. Remove CPP guard in router

**Modify:** `servers/fdr/src/controllers/docs/v2/getLibraryDocsRouter.ts`

Delete lines 51-55 (the "Language CPP is not yet implemented" error).

### Files summary:
| Action | Path |
|--------|------|
| CREATE | `servers/fdr-cpp-library-docs-parser/` (full scaffold) |
| CREATE | `servers/fdr-cpp-library-docs-parser-deploy/` (CDK stack) |
| MODIFY | `servers/fdr/src/app/FdrConfig.ts` — add cppLibraryDocsLambda config |
| MODIFY | `servers/fdr/src/services/library-docs/LibraryDocsService.ts` — add C++ Lambda invoker |
| MODIFY | `servers/fdr/src/controllers/docs/v2/getLibraryDocsRouter.ts` — remove CPP guard |

### Verification:
- `pnpm compile` passes
- `docker build` succeeds for C++ Lambda image
- `cdk synth` succeeds for CDK stack
- Existing Python tests still pass (`pnpm --filter=@fern-platform/fdr test`)

---

## Step 2: C++ IR Type Definitions (Single Source of Truth)

**Goal:** Define C++ IR as Zod schemas in fdr-sdk. Export types for server and CLI. Auto-generate Python types for the Lambda via Fern SDK generation.

### 2A. Zod schemas in fdr-sdk (FER-8680)

**Create:** `packages/fdr-sdk/src/orpc-client/library-docs/cpp.ts`

Also create shared IR schemas if they don't exist yet:
**Create:** `packages/fdr-sdk/src/orpc-client/library-docs/ir.ts`

**Export from:** `packages/fdr-sdk/src/orpc-client/library-docs/index.ts`
**Re-export from:** `packages/fdr-sdk/src/orpc-client/index.ts`

**Schema design must be informed by real CCCL Doxygen XML output.** Clone NVIDIA/cccl, run Doxygen on a subset, examine the XML, and design schemas that faithfully capture what Doxygen actually produces. Key areas to investigate:
- Namespace representation (flat vs nested, how qualifiedName appears)
- Template parameters (type params, non-type params, concepts/constraints)
- CUDA qualifiers (`__global__`, `__device__`, `__host__`) — how they appear in XML
- Class/struct/union representation including nested types
- Enum representation (scoped `enum class` vs unscoped `enum`)
- Operator overloads, typedefs/using declarations, inheritance, virtual functions

Expected schemas (exact shape TBD based on XML analysis):
- Root: `CppLibraryDocsIRSchema` (metadata + rootNamespace)
- Core: `CppNamespaceIRSchema` (recursive via `z.lazy()`), `CppClassIRSchema`, `CppFunctionIRSchema`, `CppEnumIRSchema`, `CppTypedefIRSchema`
- Supporting: `CppParameterIRSchema`, `CppMemberIRSchema`, `CppTemplateParamIRSchema`, `CppBaseClassRefSchema`, `CppEnumValueIRSchema`
- Enums: class kind, access specifier, CUDA qualifier, template param kind

Reuses shared schemas from `ir.ts`: `TypeInfoSchema`, `DocstringIRSchema`, `AttributeIRSchema`, `IRMetadataSchema`.

Export inferred types: `export type CppLibraryDocsIR = z.infer<typeof CppLibraryDocsIRSchema>`, etc.

### 2B. Auto-generate Python types for Lambda (FER-8681)

**Approach:** Use Fern SDK generation (same pattern as PR #7333 for Python IR types). No hand-written Pydantic models.

1. Add C++ IR types to the OpenAPI spec at `fern/apis/library-docs-ir/openapi.json` using named `$ref` schemas
2. Update `generators.yml` to generate a local Python SDK to `servers/fdr-cpp-library-docs-parser/src/generated/`
3. Lambda imports from `src.generated` — no hand-written Pydantic models needed

Key considerations (from PR #7333 learnings):
- Use named `$ref` schemas to avoid unusable inlined type names
- Recursive types need self-referencing `$ref` + `update_forward_refs`
- Field names in OpenAPI spec must match Zod schema field names (camelCase)

### 2C. Validate with CCCL Doxygen XML (FER-8682)

**After** creating schemas, run Doxygen on a CCCL subset locally to validate:
1. Clone NVIDIA/cccl
2. Run Doxygen with optimized settings on `libcudacxx/include/cuda/std/`
3. Examine compound XML files
4. Hand-craft a sample IR JSON from real XML output
5. Validate sample IR against both Zod schemas and generated Python types
6. Adjust schemas if needed (apply to both Zod and OpenAPI spec)
7. Commit `fixtures/cccl-sample-ir.json` for use in later tickets' tests

This is a critical validation step — if the schema misses features, fix before building the Lambda.

### Files summary:
| Action | Path |
|--------|------|
| CREATE | `packages/fdr-sdk/src/orpc-client/library-docs/ir.ts` |
| CREATE | `packages/fdr-sdk/src/orpc-client/library-docs/cpp.ts` |
| CREATE | `packages/fdr-sdk/src/orpc-client/library-docs/index.ts` |
| MODIFY | `packages/fdr-sdk/src/orpc-client/index.ts` — re-export library-docs |
| MODIFY | `fern/apis/library-docs-ir/openapi.json` — add C++ IR schemas |
| MODIFY | `fern/apis/library-docs-ir/generators.yml` — add C++ Lambda target |
| GENERATE | `servers/fdr-cpp-library-docs-parser/src/generated/` — auto-generated Python SDK |

### Verification:
- `pnpm compile` passes
- Zod schemas parse sample C++ IR JSON without errors
- Generated Python types validate same JSON
- `fern generate --api library-docs-ir --group local` succeeds

---

## Step 3: Implement C++ Lambda

**Goal:** Fill in the stub Lambda with real logic: clone, Doxygen, parse XML, build IR.

### 3A. Git clone + project detection

| Module | Implementation |
|--------|---------------|
| `git_clone.py` | Shallow clone, optional branch. Same pattern as Python parser |
| `project_detector.py` | Find header dirs (`include/`, `src/`), detect CUDA (`.cu`, `.cuh`), extract project name |

### 3B. Doxygen execution

| Module | Implementation |
|--------|---------------|
| `doxygen_runner.py` | Generate optimized Doxyfile, invoke `doxygen` CLI, validate XML exists |

**Key Doxygen settings:**
- `XML_PROGRAMLISTING=NO`, `REFERENCED_BY_RELATION=NO`, `VERBATIM_HEADERS=NO`
- `EXTRACT_PRIVATE=NO`, `HIDE_UNDOC_MEMBERS=YES`
- `EXTENSION_MAPPING=cu=C++ cuh=C++`
- `NUM_PROC_THREADS=0`

### 3C. Memory-safe XML parsing

| Module | Implementation |
|--------|---------------|
| `memory_safe_extractor.py` | Parse `index.xml` via `iterparse`, process one compound XML at a time, gc.collect() between large files |
| `namespace_extractor.py` | `<compounddef kind="namespace">` -> CppNamespaceIR |
| `class_extractor.py` | `<compounddef kind="class/struct">` -> CppClassIR |
| `function_extractor.py` | `<memberdef kind="function">` -> CppFunctionIR (all modifiers) |
| `enum_extractor.py` | `<memberdef kind="enum">` -> CppEnumIR |
| `docstring_extractor.py` | `<detaileddescription>` -> DocstringIR |
| `cuda_detector.py` | Detect `__global__`/`__device__`/`__host__` from type strings |
| `type_resolver.py` | Resolve Doxygen refid references to qualified names |

**Namespace hierarchy:** Doxygen outputs flat namespaces. Reconstruct by splitting `qualifiedName` on `::` and nesting.

### 3D. Handler orchestration

`handler.py` chains: clone -> detect -> doxygen -> parse XML -> build IR -> upload JSON to S3.

Same output format as Python: `{ "ir": {...}, "metadata": { jobId, sourceUrl, ... } }`

### Tests:
- Unit tests per extractor with Doxygen XML fixture snippets
- `test_memory_safe_extractor.py` — end-to-end with fixture directory
- `test_cuda_detector.py` — all qualifier combinations
- Integration test: run against small C++ project, verify IR structure
- **CCCL validation:** run against CCCL subset, verify no OOM and IR is complete

---

## Step 4: C++ Docs Generator (fern CLI repo)

**Goal:** Convert C++ IR to MDX files locally.

**Location:** `fern-api/fern` repo at `packages/cli/library-docs-generator/`

### 4A. CppDocsGenerator

**Create:** `src/CppDocsGenerator.ts`

Same 3-stage pipeline as `PythonDocsGenerator.ts`:
1. Build type link data (traverse namespaces, collect qualified names)
2. Render pages (recursive namespace traversal, write MDX)
3. Build navigation (`_navigation.yml`)

Import types: `import type { CppLibraryDocsIR } from "@fern-api/fdr-sdk/orpc-client"`

### 4B. C++ Renderers (FER-8687)

Renderers needed for: namespaces, classes/structs/unions, functions, enums, typedefs. **Specific rendering design (layout, badges, grouping, signature format) TBD — needs separate design pass before implementation.**

Should handle C++-specific concepts: template params, access specifiers, CUDA qualifiers, operator overloads, inheritance. Uses `::` as separator (not `.` like Python).

Reuse shared utilities from Python where possible: `DocstringRenderer`, `MdxFileWriter`, `NavigationBuilder`, `utils/mdx.ts`

### 4C. CLI dispatch

**Modify:** `packages/cli/cli/src/commands/docs-md-generate/generateLibraryDocs.ts`

After fetching IR, dispatch to C++ generator when language is CPP.

### 4D. Tests

- Unit tests per renderer with synthetic C++ IR
- Integration: IR -> MDX + `_navigation.yml`
- Fixture: CCCL subset IR -> complete MDX generation

---

## Execution Order

```
Step 1: Scaffold backend (stubs + wiring)                    [FER-8677 ✓, FER-8678 ✓, FER-8679]
   ↓  verify: compiles, Docker builds, CDK synths
Step 2: C++ IR types (Zod + generated SDK) + CCCL validation [FER-8680, FER-8681, FER-8682]
   ↓  verify: schemas parse real CCCL data
Step 3: Implement Lambda (clone + Doxygen + parse + IR)      [FER-8683, FER-8684, FER-8685, FER-8686]
   ↓  verify: end-to-end with CCCL subset
Step 4: CLI generator (renderers + navigation)               [FER-8687, FER-8688]
   ↓  verify: IR -> MDX, fern docs md generate works
```

Steps 3 and 4 can be parallelized once Step 2 is done.

---

## Future: Upgrade to Two-Stage Pipeline (if needed)

If CCCL hits Lambda limits (15 min timeout, 10 GB storage, 4 GB memory):
1. Split Lambda into Doxygen Lambda + Parser Lambda
2. Add Step Functions state machine for orchestration
3. Add SFN client to LibraryDocsService
4. CDK stack deploys both Lambdas + Step Function

This is the architecture from `CPP-LIBRARY-DOCS-PLAN.md` — preserved as a known upgrade path, not v1 scope.

---

## Key Reference Files

| File | Purpose |
|------|---------|
| `servers/fdr-python-library-docs-parser/src/handler.py` | Reference: Lambda handler pattern |
| `servers/fdr-python-library-docs-parser-deploy/scripts/fdr-python-library-docs-parser-stack.ts` | Reference: CDK deployment |
| `servers/fdr/src/services/library-docs/LibraryDocsService.ts` | Service layer (add C++ invoker) |
| `servers/fdr/src/app/FdrConfig.ts` | Config (add C++ Lambda config) |
| `servers/fdr/src/controllers/docs/v2/getLibraryDocsRouter.ts` | Router (remove CPP guard) |
| `packages/fdr-sdk/src/orpc-client/pdf-export/contract.ts` | Reference: oRPC Zod schema pattern |
| `fern/apis/fdr/definition/library-docs/ir.yml` | Shared IR types (mirror in Zod) |
| `fern/apis/fdr/definition/library-docs/python.yml` | Python IR (reference for C++ IR design) |
| `fern/apis/library-docs-ir/openapi.json` | OpenAPI spec for SDK generation (add C++ types here) |
| `fern/apis/library-docs-ir/generators.yml` | Fern SDK generation config |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Doxygen fails on CUDA | Medium | High | CCCL uses Doxygen publicly; test in Step 2 |
| Single Lambda hits timeout | Medium | High | 15 min limit; upgrade to two-stage if needed |
| Single Lambda hits memory | Low | High | 4GB + file-at-a-time parsing; Fargate fallback |
| IR schema misses C++ features | Medium | Medium | Validate against real CCCL XML in Step 2 before finalizing |
| CLI type drift | Low | Medium | Zod schemas in fdr-sdk = single source of truth |
