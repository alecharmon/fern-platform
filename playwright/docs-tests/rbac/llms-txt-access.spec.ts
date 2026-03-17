import { expect, test } from "@playwright/test";
import { DOCS_URL, loginWithPassword, PASSWORDS } from "./helpers";

test.describe("LLMs.txt Access", () => {
    test("unauthenticated llms.txt returns not-logged-in", async ({ page }) => {
        await page.goto(`${DOCS_URL}/llms.txt`);
        const content = await page.locator("body").textContent();
        expect(content).toContain("not logged in");
    });

    test("unauthenticated llms-full.txt returns not-logged-in", async ({ page }) => {
        await page.goto(`${DOCS_URL}/llms-full.txt`);
        const content = await page.locator("body").textContent();
        expect(content).toContain("not logged in");
    });

    test("admin llms.txt includes admin pages and excludes developer/partner", async ({ page }) => {
        await loginWithPassword(page, PASSWORDS.admin);
        await page.goto(`${DOCS_URL}/llms.txt`);
        const content = (await page.locator("body").textContent()) ?? "";
        // Should include
        expect(content).toContain("Welcome");
        expect(content).toContain("Admin Only Page");
        expect(content).toContain("Admin Dashboard");
        expect(content).toContain("User Management");
        // Should exclude
        expect(content).not.toContain("Developer Guide");
        expect(content).not.toContain("API Internals");
        expect(content).not.toContain("Partner Integration");
    });

    test("developer llms.txt includes developer pages and excludes admin/partner", async ({ page }) => {
        await loginWithPassword(page, PASSWORDS.developer);
        await page.goto(`${DOCS_URL}/llms.txt`);
        const content = (await page.locator("body").textContent()) ?? "";
        // Should include
        expect(content).toContain("Welcome");
        expect(content).toContain("Developer Guide");
        expect(content).toContain("API Internals");
        // Should exclude
        expect(content).not.toContain("Admin Only Page");
        expect(content).not.toContain("Admin Dashboard");
        expect(content).not.toContain("Partner Integration");
    });

    test("partner llms.txt includes partner pages and excludes admin/developer", async ({ page }) => {
        await loginWithPassword(page, PASSWORDS.partner);
        await page.goto(`${DOCS_URL}/llms.txt`);
        const content = (await page.locator("body").textContent()) ?? "";
        // Should include
        expect(content).toContain("Welcome");
        expect(content).toContain("Partner Integration");
        expect(content).toContain("Partner API Keys");
        // Should exclude
        expect(content).not.toContain("Admin Only Page");
        expect(content).not.toContain("Developer Guide");
    });

    test("all-roles llms.txt includes all pages", async ({ page }) => {
        await loginWithPassword(page, PASSWORDS.all);
        await page.goto(`${DOCS_URL}/llms.txt`);
        const content = (await page.locator("body").textContent()) ?? "";
        expect(content).toContain("Welcome");
        expect(content).toContain("Admin Only Page");
        expect(content).toContain("Developer Guide");
        expect(content).toContain("Partner Integration");
    });
});
