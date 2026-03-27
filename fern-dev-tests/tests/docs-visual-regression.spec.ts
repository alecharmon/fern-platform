import { expect, test } from "@playwright/test";

import { compareScreenshot } from "../utils/visual-regression";

/**
 * Visual regression tests for docs sites deployed to dev.
 *
 * Takes a screenshot of the front page and compares it against the stored
 * baseline. If the pixel difference exceeds the threshold, the test fails
 * and a diff image is saved.
 *
 * To add a new site, add a new test.describe block below.
 * To create new baselines (e.g., after an intentional redesign):
 *   UPDATE_BASELINES=true npx playwright test tests/docs-visual-regression.spec.ts
 */

const SITES: { name: string; url: string; waitAfterLoad?: number; expandAll?: boolean }[] = [
    {
        name: "multi-repo-smoke-test",
        url: "https://multi-repo-smoke-test.docs.dev.buildwithfern.com"
    },
    {
        name: "multi-repo-smoke-test-nemo",
        url: "https://multi-repo-smoke-test.docs.dev.buildwithfern.com/nemo"
    },
    {
        name: "multi-repo-smoke-test-nemo-rl",
        url: "https://multi-repo-smoke-test.docs.dev.buildwithfern.com/nemo/nemo-rl"
    },
    {
        name: "basepath-test-overview",
        url: "https://with-basepath-test.docs.dev.buildwithfern.com/basepath/tests/overview"
    },
    {
        name: "basepath-test-layout-components",
        url: "https://with-basepath-test.docs.dev.buildwithfern.com/basepath/tests/layout-components"
    },
    {
        name: "basepath-test-visual-components",
        url: "https://with-basepath-test.docs.dev.buildwithfern.com/basepath/tests/visual-components"
    },
    {
        name: "basepath-test-code-components",
        url: "https://with-basepath-test.docs.dev.buildwithfern.com/basepath/tests/code-components"
    },
    {
        name: "basepath-test-interactive-components",
        url: "https://with-basepath-test.docs.dev.buildwithfern.com/basepath/tests/interactive-components"
    },
    {
        name: "basepath-test-data-components",
        url: "https://with-basepath-test.docs.dev.buildwithfern.com/basepath/tests/data-components"
    },
    {
        name: "basepath-test-conditional-content",
        url: "https://with-basepath-test.docs.dev.buildwithfern.com/basepath/tests/conditional-content"
    },
    {
        name: "basepath-test-custom-react-components",
        url: "https://with-basepath-test.docs.dev.buildwithfern.com/basepath/tests/custom-react-components"
    },
    {
        name: "basepath-test-custom-css-js",
        url: "https://with-basepath-test.docs.dev.buildwithfern.com/basepath/tests/custom-css-js"
    },
    {
        name: "basepath-test-api-snippets",
        url: "https://with-basepath-test.docs.dev.buildwithfern.com/basepath/tests/api-snippets"
    },
    {
        name: "smoke-test-dev-welcome",
        url: "https://smoke-test-dev.docs.dev.buildwithfern.com/home/welcome"
    },
    {
        name: "smoke-test-dev-concepts",
        url: "https://smoke-test-dev.docs.dev.buildwithfern.com/home/concepts"
    },
    {
        name: "smoke-test-dev-api-overview",
        url: "https://smoke-test-dev.docs.dev.buildwithfern.com/home/api-overview",
        waitAfterLoad: 5_000,
        expandAll: true
    },
    {
        name: "bigcommerce-dev-sidebar-nested",
        url: "https://bigcommerce-dev.docs.dev.buildwithfern.com/developer/docs/storefront/stencil/cli/install",
        waitAfterLoad: 5_000
    }
    // square-test visual regression tests are temporarily disabled
    // {
    //     name: "square-test-list-payment-refunds",
    //     url: "https://square-test.docs.dev.buildwithfern.com/reference/square/payments/refunds/list-payment-refunds",
    //     waitAfterLoad: 20_000
    // },
    // {
    //     name: "square-test-appointment-segment",
    //     url: "https://square-test.docs.dev.buildwithfern.com/reference/square/objects-enums/objects/commerce/bookings/appointment-segment",
    //     waitAfterLoad: 20_000
    // },
    // {
    //     name: "square-test-booking-booking-source",
    //     url: "https://square-test.docs.dev.buildwithfern.com/reference/square/objects-enums/enums/commerce/bookings/booking-booking-source",
    //     waitAfterLoad: 20_000
    // },
    // {
    //     name: "square-test-authorization-revoked",
    //     url: "https://square-test.docs.dev.buildwithfern.com/reference/square/webhook-events/dev-essentials/oauth/authorization-revoked",
    //     waitAfterLoad: 20_000
    // }
];

// Each test needs enough time for navigation + stabilization waiting
test.setTimeout(120_000);

for (const site of SITES) {
    test.describe(site.name, () => {
        test("front page", async ({ page }) => {
            await page.goto(site.url, { waitUntil: "networkidle" });
            await compareScreenshot(page, {
                name: `${site.name}-front-page`,
                fullPage: true,
                expandCollapsibles: site.expandAll ?? false,
                waitAfterLoad: site.waitAfterLoad ?? 2000
            });
        });
    });
}

// ── Changelog multi-word filter visual regression ────────────────────
const CHANGELOG_URL = "https://bigcommerce-dev.docs.dev.buildwithfern.com/developer/changelog";

test.describe("changelog-multiword-filter", () => {
    test("filtered via dropdown selection", async ({ page }) => {
        await page.goto(CHANGELOG_URL, { waitUntil: "networkidle" });

        const changelogHeading = page.locator("h1", { hasText: "Changelog" });
        await expect(changelogHeading).toBeVisible({ timeout: 30_000 });

        // Open the filter dropdown and select a multi-word option
        const filterDropdown = page.locator(".fern-filter-dropdown-button").first();
        await expect(filterDropdown).toBeVisible({ timeout: 15_000 });
        await filterDropdown.click();

        const dropdown = page.locator(".fern-dropdown");
        await expect(dropdown).toBeVisible({ timeout: 10_000 });

        const multiWordOption = dropdown.locator(".fern-filter-dropdown-item").filter({
            hasText: /\S+\s+\S+/
        });
        await multiWordOption.first().click({ force: true });
        await page.keyboard.press("Escape");
        await page.waitForURL(/filter=/, { timeout: 15_000 });
        await page.waitForLoadState("networkidle");

        await compareScreenshot(page, {
            name: "changelog-multiword-filter-selected",
            fullPage: true,
            waitAfterLoad: 2_000
        });
    });

    test("direct navigation to filtered URL", async ({ page }) => {
        await page.goto(`${CHANGELOG_URL}?filter=Storefront+API`, { waitUntil: "networkidle" });
        await page.waitForLoadState("networkidle");

        await compareScreenshot(page, {
            name: "changelog-multiword-filter-direct-nav",
            fullPage: true,
            waitAfterLoad: 2_000
        });
    });
});
