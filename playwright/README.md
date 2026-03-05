# E2E Tests

Playwright end-to-end tests for the Fern Platform.

## Authentication

Tests use a **setup project** (`auth.setup.ts`) that runs before all other tests to establish an authenticated session. The auth state is saved to `.auth/state.json` and reused by every test, so login only happens once per test run.

### Local development (manual login)

When `FERN_CI_AUTOMATED_TESTING` is **not set**, the setup project opens the login page in a headed browser and **pauses** so you can log in manually. After you've logged in:

1. Click **"Resume"** in the Playwright Inspector window
2. The auth state is saved and all remaining tests run with your session

```bash
# Start the dashboard
pnpm dashboard:dev

# Run tests in headed mode (required for manual login)
pnpm e2e:headed
```

### Cached auth state

Auth state is saved to `.auth/state.json` and **reused across test runs**. After the first login, subsequent runs skip authentication entirely (~3s setup vs 30s+). Delete the file to force a fresh login:

```bash
rm playwright/.auth/state.json
```

### CI (automated login)

When `FERN_CI_AUTOMATED_TESTING` is set, the setup project logs in automatically using CI test credentials. No manual interaction is needed.

## Setup

### Environment Variables

Create a `.env.local` file in this directory (or set these in your shell):

```bash
# Optional: set for automated CI login. Omit for manual login.
FERN_CI_AUTOMATED_TESTING="your-ci-secret"

# Dashboard URL to test against
DASHBOARD_URL="http://localhost:3001"
```

If using CI automated login, set `FERN_CI_AUTOMATED_TESTING` in the dashboard env as well.

### Running Tests

From the **playwright directory**:

```bash
# Run all tests headless
pnpm e2e

# Run all tests in a visible browser
pnpm e2e:headed

# Run dashboard tests only
pnpm e2e:dashboard

# Run in debug mode (step through tests)
pnpm e2e:debug

# Run with Playwright UI mode
pnpm e2e --ui

# View test report after a run
pnpm report
```

From the **repo root**:

```bash
# Run all e2e tests headless
pnpm test:e2e

# Run all e2e tests in a visible browser
pnpm test:e2e:headed
```

### Local Development

1. Start the dashboard: `pnpm dashboard:dev`
2. Run tests: `pnpm test:e2e:headed` (or `pnpm test:e2e` for headless)
3. On first run, log in manually when the browser opens, then click "Resume"
4. Subsequent runs reuse cached auth — no login needed
