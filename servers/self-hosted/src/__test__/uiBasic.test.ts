import { type Browser, chromium, type Page } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SELF_HOSTED_CONTAINER_NAME, setup, teardown } from "./setupSelfHostedDocs";
import { getContainerId } from "./testHelpers";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function getSingleNodeContainerId() {
    return await getContainerId("name=" + SELF_HOSTED_CONTAINER_NAME);
}

let browser: Browser;
let page: Page;

// Setup single-node container before tests
beforeAll(async () => {
    await setup();

    // Launch browser
    browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    page = await browser.newPage();
}, 60000); // 60 second timeout for setup

// Cleanup single-node container and browser after tests
afterAll(async () => {
    if (page) {
        await page.close();
    }
    if (browser) {
        await browser.close();
    }

    await teardown();
}, 30000); // 30 second timeout for cleanup

describe("Self-hosted docs UI basic functionality", () => {
    it("container is running", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();
    });

    it("docs page loads successfully", async () => {
        // Navigate to the docs page
        const response = await page.goto("http://localhost:3000", {
            waitUntil: "networkidle",
            timeout: 30000
        });

        expect(response).toBeTruthy();
        expect(response?.status()).toBe(200);
    });

    it("search button exists with correct id", async () => {
        // Navigate to the docs page if not already there
        await page.goto("http://localhost:3000", {
            waitUntil: "networkidle",
            timeout: 30000
        });

        // Check for search button with id 'fern-search-button'
        const searchButton = await page.$("#fern-search-button");
        expect(searchButton).toBeTruthy();
    }, 60000);

    it("search button can be clicked and opens dialog", async () => {
        // Navigate to the docs page if not already there
        await page.goto("http://localhost:3000", {
            waitUntil: "networkidle",
            timeout: 30000
        });

        // Verify search button exists
        const searchButton = await page.$("#fern-search-button");
        expect(searchButton).toBeTruthy();

        // Click the search button
        await searchButton?.click();

        // Wait for and verify search dialog appears
        const searchDialog = await page.waitForSelector("#fern-search-dialog", {
            state: "visible",
            timeout: 10000
        });
        expect(searchDialog).toBeTruthy();

        // Verify the dialog is actually visible
        const isVisible = await searchDialog?.isVisible();
        expect(isVisible).toBe(true);
    }, 60000);

    it("search dialog can be closed", async () => {
        // Navigate to the docs page if not already there
        await page.goto("http://localhost:3000", {
            waitUntil: "networkidle",
            timeout: 30000
        });

        // Open search dialog
        const searchButton = await page.$("#fern-search-button");
        await searchButton?.click();

        // Wait for dialog to appear
        await page.waitForSelector("#fern-search-dialog", {
            state: "visible",
            timeout: 10000
        });

        // Try to close the dialog by pressing Escape
        await page.keyboard.press("Escape");

        // Wait for dialog to be hidden or removed
        await page
            .waitForSelector("#fern-search-dialog", {
                state: "hidden",
                timeout: 5000
            })
            .catch(() => {
                // Dialog might be removed from DOM instead of hidden
                // That's also acceptable
            });

        // Verify dialog is no longer visible
        const searchDialog = await page.$("#fern-search-dialog");
        if (searchDialog) {
            const isVisible = await searchDialog.isVisible();
            expect(isVisible).toBe(false);
        }
        // If searchDialog is null, it means it was removed from DOM, which is fine
    }, 60000);
});
