# Fern Dev Tests

Post-deployment test framework for Fern dev environments. Runs on a cron schedule (every 15 min) and via manual `workflow_dispatch`.

## Current Tests

| Test file | Type | What it checks |
|---|---|---|
| `docs-health-check.spec.ts` | HTTP | Front page returns 200, `sitemap.xml` returns XML, `robots.txt` returns 200 |
| `docs-visual-regression.spec.ts` | Screenshot + pixelmatch | Full-page screenshots compared against committed baselines |
| `docs-ai-chat.spec.ts` | Browser | Clicks "Ask AI", submits a question, verifies non-empty response |
| `docs-metadata-for-url.spec.ts` | HTTP | Verifies metadata-for-url endpoint returns correct org/basepath info |
| `docs-publish-square.spec.ts` | Fern CLI + HTTP | Publishes Square docs, verifies site returns 200 |
| `check-api-endpoints-in-turbopuffer.spec.ts` | API | Verifies API endpoint chunks exist in Turbopuffer after publish |
| `normal-subpath-publish.spec.ts` | Fern CLI + API | Publishes to a subpath, verifies site + Turbopuffer chunks |
| `turbopuffer-reindex.spec.ts` | API | Triggers FAI reindex, verifies Turbopuffer chunk counts |
| `fai-reindex-direct.spec.ts` | API | Direct FAI reindex API integration test |
| `basepath-reindex-chat.spec.ts` | Fern CLI + API + FAI | Publishes per-basepath, reindexes, verifies chat isolation |
| `rbac-chat.spec.ts` | API + FAI | Verifies RBAC-scoped FAI chat responses |
| `sitemap-customer-sites.spec.ts` | Fern CLI + HTTP | Publishes customer repos, verifies every sitemap page returns 200 |
| `sitemap-lastmod.spec.ts` | HTTP | Verifies all markdown pages in sitemap have `<lastmod>` |

## Target Sites

- `multi-repo-smoke-test.docs.dev.buildwithfern.com` — health checks, visual regression, AI chat, turbopuffer reindex
- `square-test.docs.dev.buildwithfern.com` — publish test (deployed via Fern CLI)
- `fruits.docs.dev.buildwithfern.com/apple` — basepath reindex + chat test (APPLE)
- `fruits.docs.dev.buildwithfern.com/banana` — basepath reindex + chat test (BANANA)

## Run Locally

```bash
cd fern-dev-tests
npm install
npx playwright install chromium
```

Create a `.env` file with the required secrets. The service account JSON key is available in 1Password, your local filesystem (`~/Downloads/fern-dev-tests-*.json`), or Devin secrets.

```bash
# .env
GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY=<service-account-json-as-single-line>
FERN_TOKEN=<your-fern-dev-org-token>
TURBOPUFFER_API_KEY=<your-turbopuffer-key>
DEV_SMOKE_TEST_FERN_TOKEN=<your-smoke-test-token>
FAI_DEV_ENDPOINT_TOKEN=<your-fai-dev-token>
```

```bash
# Run all tests
npx playwright test

# Run a specific test file
npx playwright test tests/docs-health-check.spec.ts

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

## Soft-Fail (Allowed Failures)

Test strictness is controlled via a [Google Sheet](https://docs.google.com/spreadsheets/d/1CRERf0QHCMg8tTul5IlDEdVSfqwZbK_J-c2lXAB2FpI). After tests run, `utils/check-results.ts` reads the sheet and classifies failures:

- **Fail Soft = `y`**: failure is acceptable — CI passes, Slack says "passed" with the failures listed
- **Fail Soft = `n`**: failure is a hard failure — CI fails, Slack says "failed"
- **New test files** are auto-added to the sheet with `fail soft = y`
- If the Sheets API is unreachable, all failures are treated as hard failures

## How the GitHub Action Works

| Step | What happens |
|---|---|
| **Trigger** | Cron every 15 min, or manual `workflow_dispatch` (optionally scoped to a specific test file) |
| **Install** | `npm install` + `npx playwright install chromium` (standalone, no monorepo install) |
| **Run tests** | `npx playwright test` — files run in parallel |
| **Check results** | `utils/check-results.ts` syncs with Google Sheet, classifies hard vs soft failures |
| **On failure** | Uploads `visual-diffs` and `playwright-report` as artifacts |
| **Update baselines** | Re-runs with `UPDATE_BASELINES=true` to capture new screenshots |
| **Create PR** | If baselines changed, opens a PR on `chore/update-visual-baselines` |
| **Slack notify** | Posts to `#docs-notifs` — "passed" (soft only) or "failed" (hard), with link to update the sheet |

## Secrets

| Secret | Used by |
|---|---|
| `FERN_DEV_ORG_TESTING_TOKEN` | Publish + reindex tests — passed as `FERN_TOKEN` |
| `TURBOPUFFER_API_KEY` | Turbopuffer reindex tests — direct API queries |
| `DEV_SMOKE_TEST_FERN_TOKEN` | Basepath reindex + chat, publish tests |
| `FAI_DEV_ENDPOINT_TOKEN` | FAI reindex/chat API calls |
| `FERN_DEV_TESTS_SHEETS_API_JSON` | Google service account key for the soft-fail sheet |
| `FERNIE_SLACK_APP_TOKEN` | Slack notifications |
