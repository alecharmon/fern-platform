import { expect, test } from "@playwright/test";

import { compareScreenshot } from "../utils/visual-regression";

/**
 * Changelog multi-word filter test for docs sites deployed to dev.
 *
 * Verifies that selecting a changelog filter whose label contains spaces
 * (e.g. "Storefront API") does not crash the page with "Something went wrong!".
 * Instead, the page should navigate to ?filter=Storefront+API and display
 * the filtered changelog entries.
 *
 * The bug: selecting a multi-word filter from the dropdown causes a client-side
 * error on initial navigation. Refreshing the page with the same query string
 * works correctly.
 *
 * To run locally:
 *   cd fern-dev-tests
 *   npx playwright install chromium
 *   npx playwright test tests/changelog-multiword-filter.spec.ts
 *
 * To create/update baselines:
 *   UPDATE_BASELINES=true npx playwright test tests/changelog-multiword-filter.spec.ts
 */

const CHANGELOG_URL = "https://bigcommerce-dev.docs.dev.buildwithfern.com/developer/changelog";

test.setTimeout(120_000);

test.describe("changelog multi-word filter", () => {
    test("selecting a space-separated filter does not crash the page", async ({ page }) => {
        await page.goto(CHANGELOG_URL, { waitUntil: "networkidle" });

        // Wait for the changelog heading to confirm the page loaded
        const changelogHeading = page.locator("h1", { hasText: "Changelog" });
        await expect(changelogHeading).toBeVisible({ timeout: 30_000 });

        // Find the filter dropdown trigger and click it to open the options
        const filterDropdown = page.locator(".fern-filter-dropdown-button").first();
        await expect(filterDropdown).toBeVisible({ timeout: 15_000 });
        await filterDropdown.click();

        // Wait for the dropdown menu to appear
        const dropdown = page.locator(".fern-dropdown");
        await expect(dropdown).toBeVisible({ timeout: 10_000 });

        // Find and click a multi-word option (one that contains a space)
        const multiWordOption = dropdown.locator(".fern-filter-dropdown-item").filter({
            hasText: /\S+\s+\S+/
        });
        const optionCount = await multiWordOption.count();
        expect(optionCount, "Expected at least one multi-word filter option").toBeGreaterThan(0);

        const selectedFilterText = await multiWordOption.first().textContent();
        console.log(`Selecting multi-word filter: "${selectedFilterText}"`);
        await multiWordOption.first().click({ force: true });

        // Dismiss the dropdown (multi-select keeps it open) so it doesn't overlay content
        await page.keyboard.press("Escape");

        // Wait for the URL to update with the filter param — this is the concrete
        // signal that the Jotai atom update → React re-render → useSyncFiltersWithUrl
        // effect chain has completed, replacing the old fixed 3s sleep.
        await page.waitForURL(/filter=/, { timeout: 15_000 });

        // Let any remaining React re-renders and network fetches settle
        await page.waitForLoadState("networkidle");

        // Assert the error page is NOT shown
        const errorHeading = page.locator("text=Something went wrong!");
        const hasError = await errorHeading.isVisible();
        expect(hasError, "Page should not show 'Something went wrong!' after selecting a multi-word filter").toBe(
            false
        );

        // Assert the changelog content IS shown — the heading should still be visible
        await expect(changelogHeading).toBeVisible({ timeout: 10_000 });

        // The URL should contain the filter query parameter
        const currentUrl = page.url();
        expect(currentUrl, "URL should contain filter query parameter").toContain("filter=");
        console.log(`Page URL after filter selection: ${currentUrl}`);

        // Verify that at least one changelog entry is visible
        // Changelog entries are rendered as <article class="fern-changelog-content"> elements
        const changelogEntry = page.locator("article.fern-changelog-content").first();
        await expect(
            changelogEntry,
            "Expected at least one changelog entry to be visible after applying the filter"
        ).toBeVisible({ timeout: 15_000 });

        // Visual regression: capture the filtered changelog page
        await compareScreenshot(page, {
            name: "changelog-multiword-filter-selected",
            fullPage: true,
            waitAfterLoad: 2_000
        });

        console.log(`Filter "${selectedFilterText}" applied successfully — changelog entries visible`);
    });

    test("navigating directly to a multi-word filter URL renders correctly", async ({ page }) => {
        // This verifies the expected behavior: navigating directly with filter param works
        const filterUrl = `${CHANGELOG_URL}?filter=Storefront+API`;
        await page.goto(filterUrl, { waitUntil: "networkidle" });

        // Wait for hydration and any client-side routing to settle
        await page.waitForLoadState("networkidle");

        // The page should NOT show the error
        const errorHeading = page.locator("text=Something went wrong!");
        const hasError = await errorHeading.isVisible();
        expect(hasError, "Direct navigation to multi-word filter URL should not show error").toBe(false);

        // The changelog heading should be visible
        const changelogHeading = page.locator("h1", { hasText: "Changelog" });
        await expect(changelogHeading).toBeVisible({ timeout: 30_000 });

        // Verify that the filter chip/badge is shown with the correct text
        const filterChip = page.locator(".fern-filter-badge-selected").filter({ hasText: "Storefront API" }).first();
        await expect(filterChip, "Expected 'Storefront API' filter chip to be visible").toBeVisible({
            timeout: 10_000
        });

        // Visual regression: capture the directly-navigated filtered changelog page
        await compareScreenshot(page, {
            name: "changelog-multiword-filter-direct-nav",
            fullPage: true,
            waitAfterLoad: 2_000
        });

        console.log("Direct navigation to multi-word filter URL works correctly");
    });
});
