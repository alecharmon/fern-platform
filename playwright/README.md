# E2E Tests

Playwright end-to-end tests for the Fern Platform u

## Setup

### Environment Variables

Create a `.env.local` file in this directory (or set these in your shell):

```bash
FERN_CI_AUTOMATED_TESTING="1"
DASHBOARD_URL="localhost:3000"
```

set FERN_CI_AUTOMATED_TESTING="1" in the dashboard env as well

### Running Tests

```bash
# Run all tests
pnpm e2e

# Run all tests with ui
pnpm e2e --ui

# Run dashboard tests only
pnpm e2e:dashboard

# Run with headed browser (see the browser)
pnpm e2e:headed

# Run in debug mode
pnpm e2e:debug

# View test report
pnpm report
```

### Local Development

1. Start the dashboard: `pnpm dashboard:dev`
2. Set environment variables
3. Run tests: `pnpm --filter=@fern-platform/playwright test`
