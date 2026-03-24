import { expect, test } from "@playwright/test";

/**
 * Tests that <Schema /> components render correctly on deployed dev docs sites.
 *
 * Verifies that Schema components with nested object types are resolved into
 * visible property tables rather than left as raw MDX tags.
 *
 * Target: smoke-test-dev site where welcome.mdx includes
 *   <Schema type="PlantOrder" api="rest-api" />
 * with nested OrderCustomer, OrderLineItem, and Address types.
 */

const SCHEMA_PAGE_URL = "https://smoke-test-dev.docs.dev.buildwithfern.com/home/welcome";

test.setTimeout(60_000);

test.describe("Schema component rendering", () => {
    test("PlantOrder schema with nested objects renders properties", async ({ page }) => {
        await page.goto(SCHEMA_PAGE_URL, { waitUntil: "networkidle" });

        // Wait for the page to stabilize
        await page.waitForTimeout(3_000);

        const content = await page.textContent("body");

        // The raw <Schema> tag should NOT be visible in the rendered page
        expect(content).not.toContain("<Schema");

        // Top-level PlantOrder properties should be rendered
        expect(content).toContain("orderId");
        expect(content).toContain("customer");
        expect(content).toContain("shippingAddress");

        // Nested Address properties should be rendered (nested object expansion)
        expect(content).toContain("street");
        expect(content).toContain("city");
        expect(content).toContain("zip");

        // Nested OrderLineItem properties should be rendered (list of objects)
        expect(content).toContain("plantName");
        expect(content).toContain("quantity");
    });

    test("PlantOrder schema heading is present", async ({ page }) => {
        await page.goto(SCHEMA_PAGE_URL, { waitUntil: "networkidle" });
        await page.waitForTimeout(3_000);

        // The section heading for the schema should exist
        const heading = page.locator("text=Example Schema with nested objects");
        await expect(heading).toBeVisible();
    });
});
