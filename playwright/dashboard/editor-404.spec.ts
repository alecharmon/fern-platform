import { expect, test } from "../fixtures/auth.fixture";
import { env } from "../utils/env";

test.describe("Editor 404 page", () => {
    test("navigating to a non-existent page in editor shows not found, not error", async ({ page, orgName }) => {
        test.setTimeout(60000);

        // First, discover a valid docs URL for this org from the dashboard
        await page.goto(`${env.dashboardUrl}/${orgName}/docs`, { waitUntil: "domcontentloaded" });

        // Extract a valid docs site URL from the sidebar links
        const docsLink = page.locator('a[href*="/docs/"]').first();
        await docsLink.waitFor({ timeout: 30000 });
        const href = await docsLink.getAttribute("href");
        expect(href).toBeTruthy();

        // Parse the docs URL from the link: /{orgName}/docs/{docsUrl}
        const docsUrl = href!.split("/docs/")[1]?.split("/")[0];
        expect(docsUrl).toBeTruthy();

        // Navigate to a non-existent slug in the editor using "main" as branch
        await page.goto(
            `${env.dashboardUrl}/${orgName}/editor/${docsUrl}/main/this-page-absolutely-does-not-exist-404`,
            { waitUntil: "domcontentloaded" }
        );

        // Wait for the editor to load and resolve the page
        await expect(page.locator("h1:has-text('Sorry, we couldn\\'t find that page')")).toBeVisible({
            timeout: 30000
        });

        // Should show helpful suggestions, not a crash
        await expect(page.locator("text=Were you looking for one of these?")).toBeVisible();

        // Should NOT show the generic error crash page
        await expect(page.locator("text=We've encountered an error")).not.toBeVisible();
    });
});
