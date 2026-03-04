# Fern Dev Tests

Post-deployment test framework for Fern dev environments. Runs on a cron schedule (every 15 min) and via manual `workflow_dispatch`.

## Current Tests

| Test file | Type | What it checks |
|---|---|---|
| `docs-health-check.spec.ts` | HTTP (no browser) | Front page returns 200, `sitemap.xml` returns XML, `robots.txt` returns 200 |
| `docs-visual-regression.spec.ts` | Screenshot + pixelmatch | Full-page screenshot of front page, compares against committed baseline, fails if >1% pixels differ |
| `docs-publish-square.spec.ts` | Fern CLI + HTTP + screenshot | Clones `fern-testing-square`, runs `fern generate --docs --no-prompt`, verifies site returns 200, takes visual regression screenshot |
| `docs-ai-chat.spec.ts` | Browser interaction | Clicks "Ask AI" button, submits a question, verifies the AI returns a non-empty response |
| `turbopuffer-reindex.spec.ts` | API integration | Triggers FAI reindex (with and without basepath), polls completion, verifies Turbopuffer chunk counts and attributes |

## Target Sites

- `multi-repo-domain.docs.dev.buildwithfern.com` — health checks, visual regression, AI chat, turbopuffer reindex
- `square-test.docs.dev.buildwithfern.com` — publish test (deployed via Fern CLI)

## Run Locally

```bash
cd fern-dev-tests
npm install
npx playwright install chromium

# Run all tests
npx playwright test

# Run a specific test file
npx playwright test tests/docs-health-check.spec.ts
npx playwright test tests/docs-visual-regression.spec.ts
npx playwright test tests/docs-ai-chat.spec.ts

# Run publish test (requires FERN_TOKEN)
export FERN_TOKEN=<your-fern-dev-org-token>
npx playwright test tests/docs-publish-square.spec.ts

# Run turbopuffer reindex tests (requires FERN_TOKEN + TURBOPUFFER_API_KEY)
export TURBOPUFFER_API_KEY=<your-turbopuffer-key>
npx playwright test tests/turbopuffer-reindex.spec.ts

# Force-update baselines
UPDATE_BASELINES=true npx playwright test

# Debug mode (headed browser)
npx playwright test --headed

# View HTML report after a run
npx playwright show-report
```

## Adding a New Test

1. Create a new `.spec.ts` file in `tests/`
2. Playwright auto-discovers it — no config changes needed
3. For visual regression, import `compareScreenshot` from `../utils/visual-regression`
4. For plain HTTP checks, use Playwright's `request` fixture
5. Push to `app` — on the next cron run, any new baselines will trigger an auto-PR

## How the GitHub Action Works

| Step | What happens |
|---|---|
| **Trigger** | Cron every 15 min, or manual `workflow_dispatch` (optionally scoped to a specific test file) |
| **Install** | `npm install` + `npx playwright install chromium` (standalone, no monorepo install) |
| **Run tests** | `npx playwright test` — files run in parallel. `FERN_TOKEN` set from `FERN_DEV_ORG_TESTING_TOKEN` secret. |
| **On failure** | Uploads `visual-diffs` and `playwright-report` as artifacts |
| **Update baselines** | Re-runs with `UPDATE_BASELINES=true` to capture new screenshots |
| **Check for changes** | `git status --porcelain fern-dev-tests/baselines/` detects new or changed baselines |
| **Create PR** | If baselines changed, opens a PR on `chore/update-visual-baselines` via `peter-evans/create-pull-request` |
| **Slack notify** | Posts to `#docs-notifs` on failure with workflow link and baseline PR link |

## Secrets

| Secret | Used by |
|---|---|
| `FERN_DEV_ORG_TESTING_TOKEN` | Publish test + reindex tests — passed as `FERN_TOKEN` env var |
| `TURBOPUFFER_API_KEY` | Turbopuffer reindex tests (`turbopuffer-reindex.spec.ts`) — direct Turbopuffer API queries |
| `FERNIE_SLACK_APP_TOKEN` | Slack notifications on failure |
