## Oculus

The `oculus` subrepository is used to generate and run evaluations on Ask Fern. There are three main components:

- `generators` create an evaluation set (can either be programmatic or stochastic).
- `integrations` invoke various forms of the answer generation system to get responses.
- `evaluators` run on output responses to measure performance on various metrics.

## Integration Types

Oculus supports multiple integration types for generating answers:

- `faichat-http` (default) - Calls fai-chat service `/chat` endpoint
- `fai-local` - Runs FAI locally in-process
- `fai-http` - Calls FAI HTTP `/chat` endpoint
- `vercel-http` - Calls Vercel docs site chat endpoint (requires `VERCEL_URL`)

### Environment Variables

- `FAICHAT_URL` - FAI-Chat service URL (default: `https://fai-chat.buildwithfern.com`)
  - Dev: `https://fai-chat-dev2.buildwithfern.com`
  - Preview URLs: SSL verification is automatically disabled for non-buildwithfern.com domains
- `VERCEL_URL` - Vercel docs site URL (required for `vercel-http`)
- `FAI_URL` - FAI service URL (for `fai-http`, default: `https://fai.buildwithfern.com`)
- `FERN_TOKEN` - Auth token for FAI (required for `fai-http`)

### Selecting Integration

Integration type can be specified in multiple ways with the following priority (highest to lowest):

1. **CLI argument** (highest priority)
2. **Suite config file**


## Commands

### Generate questions for a suite

    oculus generate --suite {suite_name}

### Run full evaluation pipeline (generate answers + evaluate)

    oculus run --suite {suite_name} [--run-id {id}] [--integration {type}] [--model {model}]

### Generate answers only

    oculus answer --suite {suite_name} [--run-id {id}] [--integration {type}] [--model {model}]

### Evaluate existing answers

    oculus evaluate --suite {suite_name} --run-id {id} [--judge-model {model}]

### Generate fresh answers and compare (diff)

    oculus diff --suite {suite_name} [--questions {ids}] [--baseline]

Generates new answers and compares them against ground truth (default) or a baseline run. Outputs markdown files with detailed comparisons.

**Examples:**
```bash
# Compare all questions to ground truth
oculus diff --suite payroc

# Compare specific questions (by index or slug)
oculus diff --suite payroc --questions 1,2,3
oculus diff --suite payroc --questions 01-test-ach-transaction,02-gain-access

# Compare to most recent baseline run instead of ground truth
oculus diff --suite payroc --baseline

# Compare to specific baseline run
oculus diff --suite payroc --baseline --baseline-run 20251111_163859
```

**Output:** `results/{suite}/diffs/{diff_id}/` containing:
- `metadata.json` - Diff metadata and summary statistics
- `{question-slug}.md` - Per-question comparison with retrieved docs, sources, and subqueries

**Options:**
- `--integration`: One of `faichat-http`, `fai-local`, `fai-http`, `vercel-http` (defaults to suite config)
- `--model`: One of `claude-4-sonnet-20250514`, `command-a-03-2025` (default: `claude-4-sonnet-20250514`)
- `--judge-model`: Claude model for evaluation judging (default: `claude-opus-4-20250514`)
- `--output-dir`: Directory to save results and GitHub-formatted outputs
- `--github-output`: Generate GitHub-formatted markdown outputs (requires `--output-dir`)

**Suite Config Options:**
- `integration`: Integration type to use (overridden by CLI `--integration` flag)
- `rewrite_query`: Enable query rewriting for better retrieval (only for `fai-local` and `fai-http` integrations)

## GitHub Integration

Oculus can generate GitHub-friendly markdown outputs for use in workflows, PR comments, and job summaries:

```bash
oculus run --suite simple --output-dir ./results --github-output
```

This creates:
- `github_summary_{run_id}.md` - Concise summary for PR comments
- `github_job_summary_{run_id}.md` - Detailed summary for job summaries
- `results_{run_id}.json` - Full JSON results
