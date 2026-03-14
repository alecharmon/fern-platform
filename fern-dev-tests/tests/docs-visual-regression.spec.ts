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

const SITES: { name: string; url: string; waitAfterLoad?: number }[] = [
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
                waitAfterLoad: site.waitAfterLoad ?? 2000
            });
        });
    });
}
