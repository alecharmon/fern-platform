# E2E Tests

Playwright end-to-end tests for the Fern Platform.

## Authentication

Tests use a **setup project** (`auth.setup.ts`) that runs before all other tests to establish an authenticated session. The auth state is saved to `.auth/state.json` and reused by every test, so login only happens once per test run.

### Automated login (default)

By default, the setup project logs in using the email form with credentials:
- **Email**: `alice@acme.com` (override with `E2E_TEST_EMAIL`)
- **Password**: `buildwithfern` (override with `E2E_TEST_PASSWORD`)

The flow submits the email on the dashboard login page, then fills in the password on the Auth0 Universal Login page, and waits for redirect back to the dashboard.

### Manual login (headed mode)

To log in manually, unset `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` and run in headed mode. The setup project will open the login page and **pause** so you can log in:

1. Click **"Resume"** in the Playwright Inspector window
2. The auth state is saved and all remaining tests run with your session

```bash
E2E_TEST_EMAIL= E2E_TEST_PASSWORD= pnpm e2e:headed
```

### Cached auth state

Auth state is saved to `.auth/state.json` and **reused across test runs**. After the first login, subsequent runs skip authentication entirely (~3s setup vs 30s+). Delete the file to force a fresh login:

```bash
rm playwright/.auth/state.json
```

## Setup

### Environment Variables

Create a `.env.local` file in this directory (or set these in your shell):

```bash
# Test credentials (defaults shown — override as needed)
E2E_TEST_EMAIL="alice@acme.com"
E2E_TEST_PASSWORD="buildwithfern"

# Dashboard URL to test against
DASHBOARD_URL="http://localhost:3001"
```

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
