import { expect, test } from "../fixtures/auth.fixture";

test.describe("Editor", () => {
    test.setTimeout(120000);

    test("can open editor from docs page", async ({ homePage }) => {
        const orgName = new URL(homePage.url()).pathname.split("/").filter(Boolean)[0];
        expect(orgName).toBeTruthy();

        // Navigate to docs and find a docs site
        await homePage.goto(`/${orgName}/docs`, { waitUntil: "domcontentloaded", timeout: 30000 });

        const docsLink = homePage.locator('a[href*="/docs/"]').first();
        await docsLink.waitFor({ timeout: 30000 });
        await docsLink.click();

        // Wait for the docs detail page to load
        await homePage.waitForURL(/\/docs\//, { timeout: 30000 });

        // Click the "Edit" button to open the editor
        const editButton = homePage
            .getByRole("link", { name: /Edit/i })
            .or(homePage.locator('a[href*="/editor/"]').first());
        await editButton.waitFor({ timeout: 30000 });
        await editButton.click();

        // Wait for navigation to the editor
        await homePage.waitForURL(/\/editor\//, { timeout: 60000 });

        // Verify no crash error
        await expect(homePage.locator("text=We've encountered an error")).not.toBeVisible();
        await expect(homePage.locator("text=Page not found")).not.toBeVisible();
    });
});
