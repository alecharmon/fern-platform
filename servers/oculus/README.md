## Oculus

The `oculus` subrepository is used to generate and run evaluations on Ask Fern. There are three main components:

- `generators` create an evaluation set (can either be programmatic or stochastic).
- `integrations` invoke various forms of the answer generation system to get responses.
- `evaluators` run on output responses to measure performance on various metrics.

## Integration Types

Oculus supports multiple integration types for generating answers:

### `fai-local` (Default)
- Calls FAI functions directly in-process (Python imports)
- **Fastest** - No network overhead
- **Best for:** Development, rapid iteration, large-scale experiments
- **Tests:** FAI code logic only (not production deployment)

### `fai-http`
- Calls FAI `/chat/{domain}` HTTP endpoint
- **Medium speed** - Some network overhead
- **Best for:** Testing FAI service specifically, validating FAI API
- **Tests:** FAI service deployment (but not full production stack)

### `vercel-http`
- Calls Vercel `/api/fern-docs/search/v2/chat` endpoint (configured via `VERCEL_URL`)
- **Slowest** - Full production stack with all middleware
- **Best for:** Production validation, pre-release testing, staging tests
- **Tests:** Exact production experience (auth, tool calling, etc.)
- **Requires:** `VERCEL_URL` environment variable

### Selecting Integration

Integration type can be specified in multiple ways with the following priority (highest to lowest):

1. **CLI argument** (highest priority)
2. **Suite config file**
3. **Environment variable**
4. **Default** (`fai-local`)

**Via suite config (recommended for consistent suite behavior):**
```json
{
  "domain": "buildwithfern.com",
  "integration": "fai-http",
  "generators": ["markdown"],
  "evaluators": ["correctness"]
}
```

**Via CLI argument (overrides suite config):**
```bash
oculus answer --suite simple --integration fai-http
oculus run --suite simple --integration vercel-http
```

**Via environment variable:**
```bash
export OCULUS_INTEGRATION=vercel-http
oculus answer --suite simple
```

**Comparison workflow:**
```bash
# Run same eval with all three integrations
for integration in fai-local fai-http vercel-http; do
  oculus answer --suite simple --run-id ${integration}_test --integration $integration
  oculus evaluate --suite simple --run-id ${integration}_test
done
```

## Commands

### Generate questions for a suite

    oculus generate --suite {suite_name}

### Run full evaluation pipeline (generate answers + evaluate)

    oculus run --suite {suite_name} [--run-id {id}] [--integration {type}] [--model {model}]

### Generate answers only

    oculus answer --suite {suite_name} [--run-id {id}] [--integration {type}] [--model {model}]

### Evaluate existing answers

    oculus evaluate --suite {suite_name} --run-id {id} [--judge-model {model}]

**Options:**
- `--integration`: One of `fai-local`, `fai-http`, `vercel-http` (defaults to suite config, then `OCULUS_INTEGRATION` env var, or `fai-local`)
- `--model`: One of `claude-4-sonnet-20250514`, `command-a-03-2025` (default: `claude-4-sonnet-20250514`)
- `--judge-model`: Claude model for evaluation judging (default: `claude-opus-4-20250514`)
- `--output-dir`: Directory to save results and GitHub-formatted outputs
- `--github-output`: Generate GitHub-formatted markdown outputs (requires `--output-dir`)

## GitHub Integration

Oculus can generate GitHub-friendly markdown outputs for use in workflows, PR comments, and job summaries:

```bash
oculus run --suite simple --output-dir ./results --github-output
```

This creates:
- `github_summary_{run_id}.md` - Concise summary for PR comments
- `github_job_summary_{run_id}.md` - Detailed summary for job summaries
- `results_{run_id}.json` - Full JSON results

See [GITHUB_INTEGRATION.md](./GITHUB_INTEGRATION.md) for complete workflow examples and integration patterns.
