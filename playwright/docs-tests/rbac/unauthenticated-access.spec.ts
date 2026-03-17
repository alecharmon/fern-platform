import { expect, test } from "@playwright/test";
import { DOCS_URL } from "./helpers";

test.describe("Unauthenticated Access", () => {
    // Ensure no cookies from other tests bleed in
    test.beforeEach(async ({ page }) => {
        await page.context().clearCookies();
    });

    test("visiting home redirects to login page", async ({ page }) => {
        await page.goto(DOCS_URL);
        await expect(page).toHaveURL(/~login/);
        await expect(page.getByRole("heading", { name: "Password required" })).toBeVisible();
    });

    test("visiting a gated page redirects to login", async ({ page }) => {
        await page.goto(`${DOCS_URL}/docs/mixed-access/admin-only-page`);
        await expect(page).toHaveURL(/~login/);
    });

    test("login form shows password input and Continue button", async ({ page }) => {
        await page.goto(`${DOCS_URL}/~login`);
        await expect(page.getByRole("textbox", { name: "Enter password" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
    });

    test("llms.txt returns not-logged-in message when unauthenticated", async ({ page }) => {
        await page.goto(`${DOCS_URL}/llms.txt`);
        const content = await page.locator("body").textContent();
        expect(content).toContain("not logged in");
    });

    test("llms-full.txt returns not-logged-in message when unauthenticated", async ({ page }) => {
        await page.goto(`${DOCS_URL}/llms-full.txt`);
        const content = await page.locator("body").textContent();
        expect(content).toContain("not logged in");
    });

    test(".md endpoint returns not-logged-in when unauthenticated", async ({ page }) => {
        await page.goto(`${DOCS_URL}/welcome.md`);
        const content = await page.locator("body").textContent();
        expect(content).toContain("not logged in");
    });
});
