import { expect, test } from "@playwright/test";
import { DOCS_URL, PASSWORDS, loginWithPassword } from "./helpers";

test.describe("Role Visibility", () => {
    test.describe("admin role", () => {
        test.beforeEach(async ({ page }) => {
            await loginWithPassword(page, PASSWORDS.admin);
        });

        test("can access admin-only page", async ({ page }) => {
            await page.goto(`${DOCS_URL}/docs/mixed-access/admin-only-page`);
            await expect(page.getByRole("heading", { name: "Admin Only Page" })).toBeVisible();
        });

        test("can access admin dashboard tab page", async ({ page }) => {
            await page.goto(`${DOCS_URL}/admin-docs/administration/admin-dashboard`);
            await expect(page.getByRole("heading", { name: "Admin Dashboard" })).toBeVisible();
        });

        test("llms.txt includes admin-only page", async ({ page }) => {
            await page.goto(`${DOCS_URL}/llms.txt`);
            const content = await page.locator("body").textContent();
            expect(content).toContain("Admin Only Page");
            expect(content).toContain("Admin Dashboard");
        });

        test("llms.txt does not include developer-only pages", async ({ page }) => {
            await page.goto(`${DOCS_URL}/llms.txt`);
            const content = await page.locator("body").textContent();
            expect(content).not.toContain("Developer Guide");
            expect(content).not.toContain("API Internals");
        });

        test("llms.txt does not include partner pages", async ({ page }) => {
            await page.goto(`${DOCS_URL}/llms.txt`);
            const content = await page.locator("body").textContent();
            expect(content).not.toContain("Partner Integration");
            expect(content).not.toContain("Partner API Keys");
        });
    });

    test.describe("developer role", () => {
        test.beforeEach(async ({ page }) => {
            await loginWithPassword(page, PASSWORDS.developer);
        });

        test("can access developer guide", async ({ page }) => {
            await page.goto(`${DOCS_URL}/docs/developer-only/developer-guide`);
            await expect(page.getByRole("heading", { name: "Developer Guide" })).toBeVisible();
        });

        test("llms.txt includes developer pages", async ({ page }) => {
            await page.goto(`${DOCS_URL}/llms.txt`);
            const content = await page.locator("body").textContent();
            expect(content).toContain("Developer Guide");
            expect(content).toContain("API Internals");
        });

        test("llms.txt does not include admin-only pages", async ({ page }) => {
            await page.goto(`${DOCS_URL}/llms.txt`);
            const content = await page.locator("body").textContent();
            expect(content).not.toContain("Admin Only Page");
            expect(content).not.toContain("Admin Dashboard");
        });

        test("llms.txt does not include partner pages", async ({ page }) => {
            await page.goto(`${DOCS_URL}/llms.txt`);
            const content = await page.locator("body").textContent();
            expect(content).not.toContain("Partner Integration");
            expect(content).not.toContain("Partner API Keys");
        });
    });

    test.describe("partner role", () => {
        test.beforeEach(async ({ page }) => {
            await loginWithPassword(page, PASSWORDS.partner);
        });

        test("can access partner integration page", async ({ page }) => {
            await page.goto(`${DOCS_URL}/partner-docs/partner-resources/partner-integration-guide`);
            await expect(page.getByRole("heading", { name: "Partner Integration Guide" })).toBeVisible();
        });

        test("llms.txt includes partner pages", async ({ page }) => {
            await page.goto(`${DOCS_URL}/llms.txt`);
            const content = await page.locator("body").textContent();
            expect(content).toContain("Partner Integration");
            expect(content).toContain("Partner API Keys");
        });

        test("llms.txt does not include admin or developer pages", async ({ page }) => {
            await page.goto(`${DOCS_URL}/llms.txt`);
            const content = await page.locator("body").textContent();
            expect(content).not.toContain("Admin Only Page");
            expect(content).not.toContain("Developer Guide");
        });
    });

    test.describe("admin+developer role", () => {
        test.beforeEach(async ({ page }) => {
            await loginWithPassword(page, PASSWORDS.adminDev);
        });

        test("can access developer guide", async ({ page }) => {
            await page.goto(`${DOCS_URL}/docs/developer-only/developer-guide`);
            await expect(page.getByRole("heading", { name: "Developer Guide" })).toBeVisible();
        });

        test("can access admin-only page", async ({ page }) => {
            await page.goto(`${DOCS_URL}/docs/mixed-access/admin-only-page`);
            await expect(page.getByRole("heading", { name: "Admin Only Page" })).toBeVisible();
        });

        test("llms.txt includes both admin and developer pages", async ({ page }) => {
            await page.goto(`${DOCS_URL}/llms.txt`);
            const content = await page.locator("body").textContent();
            expect(content).toContain("Developer Guide");
            expect(content).toContain("Admin Dashboard");
            expect(content).toContain("Admin Only Page");
        });

        test("llms.txt does not include partner pages", async ({ page }) => {
            await page.goto(`${DOCS_URL}/llms.txt`);
            const content = await page.locator("body").textContent();
            expect(content).not.toContain("Partner Integration");
        });
    });
});
