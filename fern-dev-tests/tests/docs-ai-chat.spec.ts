import { expect, test } from "@playwright/test";

/**
 * AI chat tests for docs sites deployed to dev.
 *
 * Clicks the "Ask AI" button in the header which opens a fixed side panel
 * on the right side of the page. The panel is always mounted in the DOM
 * (to preserve chat history) but has CSS `hidden` class when closed.
 *
 * Key DOM elements:
 *   - #fern-ask-ai-panel-header  — panel header ("Assistant")
 *   - #fern-ask-ai-panel-input   — chat textarea ("Ask AI a question...")
 *   - [data-mode="ask-ai"]       — the cmdk root inside the panel
 */

const SITE_URL = "https://multi-repo-domain.docs.dev.buildwithfern.com";

// AI chat can take a while to respond
test.setTimeout(120_000);

test.describe("docs AI chat", () => {
    test("Ask AI returns a response", async ({ page }) => {
        await page.goto(SITE_URL, { waitUntil: "networkidle" });

        // Click the "Ask AI" button in the header to open the side panel
        const askAiButton = page.getByRole("button", { name: /Ask AI/i });
        await expect(askAiButton).toBeVisible({ timeout: 15_000 });
        // Use force:true to ensure the click registers even during page transitions
        await askAiButton.click({ force: true });

        // Wait for the side panel to open. The panel may either:
        // 1. Be a dialog (#fern-search-dialog) that opens with an animation
        // 2. Be a fixed side panel (#fern-ask-ai-panel-header)
        // We try both approaches for compatibility
        const panelHeader = page.locator("#fern-ask-ai-panel-header");
        const searchDialog = page.locator("#fern-search-dialog");

        // Wait for either element to become visible
        await Promise.race([
            panelHeader.waitFor({ state: "visible", timeout: 15_000 }),
            searchDialog.waitFor({ state: "visible", timeout: 15_000 })
        ]).catch(async () => {
            // If neither became visible, try clicking again
            await askAiButton.click({ force: true });
            await page.waitForTimeout(500);
        });

        // Check which one is visible and proceed accordingly
        const panelVisible = await panelHeader.isVisible();
        const dialogVisible = await searchDialog.isVisible();

        if (!panelVisible && !dialogVisible) {
            // Neither is visible, take a screenshot for debugging
            throw new Error("Neither panel nor dialog became visible after clicking Ask AI");
        }

        // Find the chat textarea and type a question
        const chatInput = page.getByPlaceholder("Ask AI a question");
        await expect(chatInput).toBeVisible({ timeout: 10_000 });
        await chatInput.fill("What is this documentation about?");
        await chatInput.press("Enter");

        // Wait for the AI response. After submitting, the panel shows the
        // user message in a bubble and the assistant response in a <section>
        // with class "prose". We wait for actual content (not just "Thinking").
        const assistantResponse = page.locator("[data-mode='ask-ai'] article section.prose").last();
        await expect(assistantResponse).toBeVisible({ timeout: 60_000 });

        // Wait for actual response content (not just "Thinking" loading state)
        await expect(async () => {
            const text = await assistantResponse.textContent();
            const trimmed = text?.trim() ?? "";
            // Response should have meaningful content beyond loading indicators
            expect(trimmed.length).toBeGreaterThan(10);
            expect(trimmed.toLowerCase()).not.toBe("thinking");
        }).toPass({ timeout: 60_000 });

        const text = await assistantResponse.textContent();
        console.log(`AI response (first 200 chars): ${text?.trim().slice(0, 200)}`);
    });
});
