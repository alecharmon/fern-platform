# Cross-Implementation Test Fixtures

Shared test data for validating diff-chunking and section-classification logic
across the three AUTO-versioning implementations:

| Implementation | Language   | Location                                              |
|----------------|------------|-------------------------------------------------------|
| CLI (local)    | TypeScript | `fern-api/fern` — `packages/cli/ai/`                 |
| Fiddle         | Java       | `fern-api/fiddle` — `AutoVersioningService.java`      |
| FAI service    | Python     | `fern-api/fern-platform` — `fai/utils/diff_chunking`  |

## Files

- **`section_classification.json`** — expected priority for various diff sections
- **`chunk_diff.json`** — expected chunking behaviour for small/medium/large diffs
- **`max_version_bump.json`** — pairwise expected results for the bump-priority function

## How to use

Each fixture file contains an array of test cases. Every implementation should
load these fixtures in its own test suite and assert identical behaviour.

For Python (pytest), see `tests/utils/test_diff_chunking_fixtures.py`.
