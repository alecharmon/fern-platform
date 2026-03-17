import { expect, test } from "@playwright/test";
import { DOCS_URL, loginWithPassword, PASSWORDS } from "./helpers";

test.describe("Markdown Endpoint Access", () => {
    test("unauthenticated .md endpoint returns not-logged-in", async ({ page }) => {
        await page.goto(`${DOCS_URL}/welcome.md`);
        const content = await page.locator("body").textContent();
        expect(content).toContain("not logged in");
    });

    test("authenticated .md endpoint for public page returns markdown content", async ({ page }) => {
        await loginWithPassword(page, PASSWORDS.admin);
        await page.goto(`${DOCS_URL}/welcome.md`);
        const content = await page.locator("body").textContent();
        expect(content).toContain("Welcome");
        expect(content).not.toContain("not logged in");
    });

    test("authenticated .md endpoint for admin-only page accessible with admin role", async ({ page }) => {
        await loginWithPassword(page, PASSWORDS.admin);
        await page.goto(`${DOCS_URL}/docs/mixed-access/admin-only-page.md`);
        const content = await page.locator("body").textContent();
        expect(content).toContain("Admin");
        expect(content).not.toContain("not logged in");
    });

    test("authenticated .md endpoint for developer page accessible with developer role", async ({ page }) => {
        await loginWithPassword(page, PASSWORDS.developer);
        await page.goto(`${DOCS_URL}/docs/developer-only/developer-guide.md`);
        const content = await page.locator("body").textContent();
        expect(content).toContain("Developer");
        expect(content).not.toContain("not logged in");
    });
});
