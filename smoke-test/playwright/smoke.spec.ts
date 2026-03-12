import { expect, test } from "@playwright/test";

/**
 * Smoke test pages derived from the smoke-test docs.yml navigation.
 *
 * Each entry is a path that should return a 200 OK and render without
 * uncaught page errors.
 */
const PAGES = [
    // Home tab — markdown pages
    "/home/welcome",
    "/home/home/get-started/plaintext-test",
    "/home/home/get-started/external-dependency-test",

    // Guides tab — markdown pages with explicit slugs
    "/home/concepts",
    "/home/sdks",

    // REST API reference (specific endpoint)
    "/home/rest-api/rest-api/plant/add-plant",

    // Events API reference (specific endpoint)
    "/home/events-api/events-api/inventory/inventory",

    // gRPC API reference (slug derived from display name "gRPC API")
    "/home/g-rpc-api/g-rpc-api/comments-service/createcomment",

    // Webhook API reference (specific endpoint)
    "/home/webhook-api/webhook-api/orders/on-order-created",

    // Tasks API — overview page + endpoint
    "/home/api-overview",
    "/home/tasks-api/tasks-api/create-task",

    // Changelog tab
    "/home/changelog",

    // Second product
    "/second-product/overview/getting-started/introduction",

    // Sitemap
    "/sitemap.xml"
];

test.describe("Smoke test: all pages load", () => {
    for (const pagePath of PAGES) {
        test(`GET ${pagePath} returns 200`, async ({ page }) => {
            const pageErrors: string[] = [];
            page.on("pageerror", (error) => {
                pageErrors.push(error.message);
            });

            const response = await page.goto(pagePath, {
                waitUntil: "domcontentloaded",
                timeout: 30_000
            });

            expect(response, `Expected a response for ${pagePath}`).not.toBeNull();
            expect(response!.status(), `Expected 200 for ${pagePath} but got ${response!.status()}`).toBe(200);

            // Verify there were no uncaught page errors
            expect(pageErrors, `Unexpected page errors on ${pagePath}: ${pageErrors.join(", ")}`).toHaveLength(0);
        });
    }
});
