import { Page } from "@playwright/test";

export const DOCS_URL = process.env.RBAC_DOCS_URL ?? "https://alecharmonspot-rbac.docs.buildwithfern.com";

export const PASSWORDS = {
    admin: "admin-pass",
    developer: "dev-pass",
    partner: "partner-pass",
    adminDev: "admin-dev-pass",
    all: "all-pass"
} as const;

export type RoleKey = keyof typeof PASSWORDS;

/** Login via the Fern password auth UI. Call this from beforeEach or test setup. */
export async function loginWithPassword(page: Page, password: string, targetUrl = DOCS_URL): Promise<void> {
    await page.goto(`${targetUrl}/~login`);
    await page.getByRole("textbox", { name: "Enter password" }).fill(password);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL((url) => !url.pathname.includes("~login"));
}

/** Navigate to a page slug (e.g. "docs/mixed-access/admin-only-page"). */
export async function navigateToPage(page: Page, slug: string): Promise<void> {
    await page.goto(`${DOCS_URL}/${slug}`);
}
