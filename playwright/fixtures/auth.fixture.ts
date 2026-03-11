import { test as base, Page } from "@playwright/test";
import { env } from "../utils/env";

export interface AuthFixtures {
  /**
   * Pre-authenticated page on the dashboard.
   * Uses the saved auth state from auth.setup.ts (storageState).
   */
  homePage: Page;

  /**
   * Organization slug extracted from the dashboard URL after login.
   */
  orgName: string;
}

export const test = base.extend<AuthFixtures>({
  homePage: async ({ page }, use) => {
    await page.goto(`/${env.orgSlug}/`);
    await page.waitForURL(
      (url) => url.pathname.startsWith(`/${env.orgSlug}`),
      { timeout: 30000 }
    );
    await use(page);
  },

  orgName: async ({ homePage }, use) => {
    const slug = new URL(homePage.url()).pathname.split("/").filter(Boolean)[0];
    if (!slug) {
      throw new Error("Could not extract orgName from dashboard URL");
    }
    await use(slug);
  },
});

export { expect } from "@playwright/test";
