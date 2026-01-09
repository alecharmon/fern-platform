import { test as base, Page, Browser } from "@playwright/test";
import { getTestUser, UserRole, TestUser } from "./users.config";
import { env } from "../utils/env";

export interface AuthFixtures {
  /**
   * Login as a specific user role and return a new page
   */
  loginAs: (role: UserRole) => Promise<Page>;

  /**
   * Pre-authenticated page as admin
   */
  homePage: Page;
}

async function performLogin(
  browser: Browser,
  user: TestUser,
  baseUrl: string,
  ciSecret: string
): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to login with CI testing param to show password form
  const loginUrl = `${baseUrl}/login?FERN_CI_AUTOMATED_TESTING=${encodeURIComponent(ciSecret)}`;
  await page.goto(loginUrl);

  // Fill in CI test login form
  await page.fill('[data-testid="ci-email-input"]', user.email);
  await page.fill('[data-testid="ci-password-input"]', user.password);
  await page.click('[data-testid="ci-submit-button"]');

  // Wait for redirect to dashboard (successful login)
  await page.waitForURL("**/", { timeout: 30000 });

  return page;
}

export const test = base.extend<AuthFixtures>({
  loginAs: async ({ browser }, use) => {
    const pages: Page[] = [];

    const login = async (role: UserRole): Promise<Page> => {
      const user = getTestUser(role);
      if (!user) {
        throw new Error(
          `No test user configured for role: ${role}. Check FERN_CI_AUTOMATED_TESTING env var.`
        );
      }

      const page = await performLogin(
        browser,
        user,
        env.dashboardUrl,
        env.ciTestingSecret
      );
      pages.push(page);
      return page;
    };

    await use(login);

    // Cleanup: close all pages created by loginAs
    for (const page of pages) {
      await page.context().close();
    }
  },

  homePage: async ({ loginAs }, use) => {
    const page = await loginAs("admin");
    await use(page);
  },
});

export { expect } from "@playwright/test";
