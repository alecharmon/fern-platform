import { expect, test } from "../fixtures/auth.fixture";
import { env } from "../utils/env";

test.describe("Bad docs URL in route parameter", () => {
    test("shows not found page in dashboard main", async ({ page, orgName }) => {
        const badDocsUrl = "this-site-does-not-exist.example.com";
        await page.goto(`${env.dashboardUrl}/${orgName}/docs/${encodeURIComponent(badDocsUrl)}`);

        // Should show the docs not-found page with the bad URL
        await expect(page.locator("text=was not found")).toBeVisible({ timeout: 15000 });
        await expect(page.locator(`code:has-text("${badDocsUrl}")`)).toBeVisible();

        // Should NOT show the generic error crash page
        await expect(page.locator("text=We've encountered an error")).not.toBeVisible();
    });

    test("shows not found page in editor", async ({ page, orgName }) => {
        test.setTimeout(60000);
        const badDocsUrl = "this-site-does-not-exist.example.com";
        await page.goto(`${env.dashboardUrl}/${orgName}/editor/${encodeURIComponent(badDocsUrl)}/main/some-page`, {
            waitUntil: "domcontentloaded"
        });

        // Should show a not-found / permissions page, not an error crash
        await expect(page.locator("text=doesn't exist or you don't have permissions")).toBeVisible({
            timeout: 30000
        });
        await expect(page.locator("text=We've encountered an error")).not.toBeVisible();

        // Should offer a way to navigate away
        await expect(page.locator("text=Return home")).toBeVisible();
    });
});
