import { expect, test } from "../fixtures/auth.fixture";

test.describe("Docs Page Tabs", () => {
    test.setTimeout(90000);

    let orgName: string;
    let docsUrl: string;

    test.beforeEach(async ({ homePage }) => {
        orgName = new URL(homePage.url()).pathname.split("/").filter(Boolean)[0];
        expect(orgName).toBeTruthy();

        // Navigate to docs list and find a docs site
        await homePage.goto(`/${orgName}/docs`, { waitUntil: "domcontentloaded", timeout: 30000 });

        const docsLink = homePage.locator('a[href*="/docs/"]').first();
        await docsLink.waitFor({ timeout: 30000 });
        const href = await docsLink.getAttribute("href");
        expect(href).toBeTruthy();
        docsUrl = href!.split("/docs/")[1]?.split("/")[0] ?? "";
        expect(docsUrl).toBeTruthy();
    });

    test("Overview tab loads by default", async ({ homePage }) => {
        await homePage.goto(`/${orgName}/docs/${docsUrl}`, { timeout: 30000 });

        await expect(homePage.getByText("Overview").first()).toBeVisible({ timeout: 30000 });
        await expect(homePage.locator("text=We've encountered an error")).not.toBeVisible();
    });

    test("Web Analytics tab loads", async ({ homePage }) => {
        await homePage.goto(`/${orgName}/docs/${docsUrl}/web-analytics`, { timeout: 30000 });

        await expect(homePage.getByText("Web Analytics").first()).toBeVisible({ timeout: 30000 });
        await expect(homePage.locator("text=We've encountered an error")).not.toBeVisible();
    });

    test("Search tab loads", async ({ homePage }) => {
        await homePage.goto(`/${orgName}/docs/${docsUrl}/search`, { timeout: 30000 });

        await expect(homePage.getByText("Total searches").first()).toBeVisible({ timeout: 30000 });
        await expect(homePage.locator("text=We've encountered an error")).not.toBeVisible();
    });

    test("Link Checker tab loads", async ({ homePage }) => {
        await homePage.goto(`/${orgName}/docs/${docsUrl}/link-checker`, { timeout: 30000 });

        await expect(homePage.getByRole("heading", { name: "Link Checker" })).toBeVisible({ timeout: 30000 });
        await expect(homePage.locator("text=We've encountered an error")).not.toBeVisible();
    });

    test("Feedback tab loads", async ({ homePage }) => {
        await homePage.goto(`/${orgName}/docs/${docsUrl}/feedback`, { timeout: 30000 });

        await expect(homePage.getByText("Feedback").first()).toBeVisible({ timeout: 30000 });
        await expect(homePage.locator("text=We've encountered an error")).not.toBeVisible();
    });
});
