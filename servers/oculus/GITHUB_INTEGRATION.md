# GitHub Integration Guide

This guide explains how to use Oculus evaluation results in GitHub Actions workflows and PRs.

## GitHub Output Format

Oculus can generate GitHub-friendly markdown outputs using the `--github-output` flag along with `--output-dir`.

### Usage

```bash
oculus run --suite simple --output-dir ./results --github-output
```

This creates three files in the output directory:
- `results_{run_id}.json` - Full JSON results
- `github_summary_{run_id}.md` - Concise summary for PR comments
- `github_job_summary_{run_id}.md` - Detailed summary for job summaries

If running in GitHub Actions with `GITHUB_STEP_SUMMARY` environment variable set, the job summary is also automatically appended to the workflow summary.

## GitHub Actions Integration

### Option 1: Workflow Artifacts + Job Summary (Recommended)

```yaml
name: Run Oculus Evaluation

on:
  pull_request:
    paths:
      - 'packages/fern-docs/search-server/ask-fern/**'

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd servers/oculus
          pip install poetry
          poetry install

      - name: Run evaluation
        run: |
          cd servers/oculus
          poetry run oculus run \
            --suite simple \
            --output-dir ./results \
            --github-output \
            --run-id "${{ github.run_id }}"

      - name: Upload results artifact
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: oculus-results-${{ github.run_id }}
          path: servers/oculus/results/
          retention-days: 90

      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const summaryPath = 'servers/oculus/results/github_summary_${{ github.run_id }}.md';
            const summary = fs.readFileSync(summaryPath, 'utf8');

            const artifactUrl = `https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}`;
            const commentBody = summary + `\n\n📊 [View detailed results in Actions](${artifactUrl})`;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: commentBody
            });
```

**Benefits:**
- Job summary is automatically visible in the Actions UI
- Full results are available as downloadable artifacts (90 days retention)
- PR comment shows high-level summary with link to details
- No additional storage or services required

### Option 2: With Artifact Link

To include a direct link to artifacts in the summary, modify the workflow:

```yaml
      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const summaryPath = 'servers/oculus/results/github_summary_${{ github.run_id }}.md';
            let summary = fs.readFileSync(summaryPath, 'utf8');

            const artifactUrl = `https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}`;
            summary = summary.replace('Full results available in workflow artifacts',
                                     `[Download full results](${artifactUrl})`);

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: summary
            });
```

### Option 3: Commit Results to Branch

For tracking evaluation results over time:

```yaml
      - name: Commit results
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git checkout -B oculus-results
          git add servers/oculus/results/
          git commit -m "Evaluation results for run ${{ github.run_id }}"
          git push origin oculus-results --force
```

**Note:** This creates/updates a dedicated `oculus-results` branch with evaluation history.

## Output Format Examples

### GitHub Summary (PR Comment)

```markdown
## 🔍 Oculus Evaluation Results

**Suite:** `simple` | **Run ID:** `20250106_143022` | **Timestamp:** 2025-01-06 14:30:22

### Summary
- ✅ **Accuracy:** 62.5% (25/40 questions correct)

### Breakdown by Category
| Category | Correct | Total | Accuracy |
|----------|---------|-------|----------|
| markdown | 18 | 30 | 60.0% |
| openapi | 7 | 10 | 70.0% |

<details>
<summary>📊 View Failed Questions (15)</summary>

**1. How can I make an accordion section display expanded by default?**
- ❌ **Expected:** Use the `defaultOpen` property...
- ❌ **Got:** ERROR: 'Row' object has no attribute 'get'
...
</details>

📎 Full results available in workflow artifacts
```

### GitHub Job Summary

The job summary includes:
- Complete metrics breakdown
- Collapsible sections for passed/failed questions
- Full question/answer/reasoning details
- Metadata (slug, category) for each evaluation

## Environment Variables

- `GITHUB_STEP_SUMMARY` - Automatically set by GitHub Actions, used to append to job summary

## Automated PR Evaluation

The repository includes an automated workflow (`.github/workflows/oculus-eval-pr.yml`) that runs Oculus evaluations on pull requests that modify Ask Fern code.

### How it works

1. **Triggers** when a PR modifies files in `packages/fern-docs/search-server/ask-fern/**`
2. **Waits** for Vercel preview deployment to complete
3. **Runs** Oculus eval suite against the preview deployment
4. **Posts** results as a PR comment with high-level summary
5. **Uploads** full results as workflow artifacts

### Configuration

The workflow uses these environment variables and secrets:
- `VERCEL_URL` - Automatically set from Vercel preview deployment
- `ANTHROPIC_API_KEY` - Required secret for Claude API access
- `GITHUB_TOKEN` - Automatically provided by GitHub Actions
- `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` - Pre-configured in workflow

### Workflow behavior

- **Concurrency**: Only one eval runs per PR at a time (previous runs are cancelled)
- **Integration**: Uses `vercel-http` to test the full production stack
- **Suite**: Runs the `simple` test suite
- **Results**: Posted as PR comment and updated on subsequent runs
- **Artifacts**: Retained for 90 days

### Required secrets

Ensure these secrets are configured in your repository:
- `ANTHROPIC_API_KEY` - Your Anthropic API key for Claude
- `GITHUB_TOKEN` - Automatically provided, needs `pull-requests: write` permission

## Best Practices

1. **Use workflow artifacts** for storing full results - they're free, easy to access, and automatically cleaned up
2. **Keep PR comments concise** - use the high-level summary with collapsible sections for failures
3. **Link to job summary** for detailed analysis without cluttering the PR
4. **Set appropriate artifact retention** - default is 90 days, adjust based on your needs
5. **Add workflow filters** to only run on relevant file changes

## Troubleshooting

**"Warning: --github-output requires --output-dir"**
- You must specify `--output-dir` when using `--github-output`

**No job summary appears in Actions**
- Verify `GITHUB_STEP_SUMMARY` environment variable is set (automatically set by GitHub Actions)
- Check the workflow logs for "GitHub job summary appended to" message

**PR comment not appearing**
- Ensure the workflow has `pull_request` event trigger
- Verify GitHub token has permissions to comment on PRs (`permissions.pull-requests: write`)
