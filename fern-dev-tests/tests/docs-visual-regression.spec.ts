import { test } from "@playwright/test";
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

const SITES = [
    {
        name: "multi-repo-domain",
        url: "https://multi-repo-domain.docs.dev.buildwithfern.com"
    },
    {
        name: "multi-repo-domain-nemo",
        url: "https://multi-repo-domain.docs.dev.buildwithfern.com/nemo"
    },
    {
        name: "multi-repo-domain-nemo-rl",
        url: "https://multi-repo-domain.docs.dev.buildwithfern.com/nemo/nemo-rl"
    }
];

for (const site of SITES) {
    test.describe(site.name, () => {
        test("front page", async ({ page }) => {
            await page.goto(site.url, { waitUntil: "networkidle" });
            await compareScreenshot(page, {
                name: `${site.name}-front-page`,
                fullPage: true,
                waitAfterLoad: 1000
            });
        });
    });
}
