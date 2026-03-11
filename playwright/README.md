# E2E Tests

Playwright end-to-end tests for the Fern Platform.

## Authentication

Tests authenticate via the real SSO login flow (Keycloak). A single setup worker logs in once and saves browser state to `.auth/state.json`. All tests reuse that saved state so every test starts pre-authenticated.

### Test Users

| Role | Email | Password |
|------|-------|----------|
| admin | alice@acme.com | password |
| member | bob@acme.com | password |

These users must exist in the configured identity provider (Keycloak).

## Setup

### Environment Variables

Create a `.env.local` file in this directory (or set these in your shell):

```bash
# Dashboard URL to test against
DASHBOARD_URL="http://localhost:3001"
```

### Running Tests

From the **playwright directory**:

```bash
# Run all tests (headless, SSO login with test credentials)
pnpm e2e

# Run dashboard tests only
pnpm e2e:dashboard

# Run docs tests only
pnpm e2e:docs

# Run chromium only
pnpm e2e:chromium

# Run with headed browser (see the browser)
pnpm e2e:headed

# Run in debug mode (step through tests)
pnpm e2e:debug

# Run all tests with Playwright UI
pnpm e2e --ui

# View test report
pnpm report
```

### Manual Login Mode

If you want to log in interactively instead of using test credentials:

```bash
PLAYWRIGHT_MANUAL_AUTH=1 pnpm e2e:headed
```

The browser will open the login page and pause. Log in manually, then click "Resume" in the Playwright inspector. Your session is saved to `.auth/state.json` and reused on future runs. Delete that file to force a fresh login.

## Writing Tests

### Authenticated tests

Most tests use the saved auth state automatically via `storageState` in the config. Just import from `@playwright/test`:

```typescript
import { test, expect } from "@playwright/test";

test("my test", async ({ page }) => {
    // page is already authenticated
    await page.goto("/my-org/docs");
});
```

For the `homePage` fixture (navigates to dashboard and waits for load):

```typescript
import { test, expect } from "../fixtures/auth.fixture";

test("my test", async ({ homePage }) => {
    // homePage is on the dashboard, ready to go
});
```

### Unauthenticated tests

Tests that need the login page (e.g. testing login flow, login page display) must clear the stored auth state:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Login page tests", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("shows login form", async ({ page }) => {
        await page.goto("/login");
        // page is unauthenticated, login form is visible
    });
});
```

### Fresh SSO login in a test

For tests that need to perform a real SSO login (e.g. testing redirect behavior during login):

```typescript
import { test } from "@playwright/test";
import { getTestUser } from "../fixtures/users.config";
import { ssoLogin } from "../utils/sso-login";
import { env } from "../utils/env";

test.describe("My login flow tests", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("login redirects correctly", async ({ browser }) => {
        const user = getTestUser("admin");
        const context = await browser.newContext();
        const page = await context.newPage();

        await ssoLogin(page, user, env.dashboardUrl);
        // page is now authenticated via SSO
    });
});
```

## Local Development

1. Start the dashboard: `pnpm dashboard:dev`
2. Create `.env.local` with `DASHBOARD_URL`
3. Run tests: `pnpm e2e`
