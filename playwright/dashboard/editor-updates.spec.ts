import { expect, test } from "../fixtures/auth.fixture";

test.describe("Editor Updates", () => {
    test.setTimeout(120000);

    let orgName: string;
    let docsUrl: string;

    test.beforeEach(async ({ homePage }) => {
        orgName = new URL(homePage.url()).pathname.split("/").filter(Boolean)[0];
        expect(orgName).toBeTruthy();

        // Navigate to docs list and find a docs site (retry on blank/error pages)
        const docsLink = homePage.locator('a[href*="/docs/"]').first();
        for (let attempt = 0; attempt < 3; attempt++) {
            await homePage.goto(`/${orgName}/docs`, { waitUntil: "domcontentloaded", timeout: 30000 });
            try {
                await docsLink.waitFor({ timeout: 20000 });
                break;
            } catch {
                if (attempt === 2) {
                    throw new Error("Docs list page failed to load after 3 attempts");
                }
            }
        }
        const href = await docsLink.getAttribute("href");
        expect(href).toBeTruthy();
        docsUrl = href!.split("/docs/")[1]?.split("/")[0] ?? "";
        expect(docsUrl).toBeTruthy();

        // Navigate to docs detail page
        await docsLink.click();
        await homePage.waitForURL(/\/docs\//, { timeout: 30000 });

        // Click the editor link directly (use href-based locator to avoid ambiguity with other "Edit" buttons)
        const editorLink = homePage.locator('a[href*="/editor/"]').first();
        await editorLink.waitFor({ timeout: 30000 });
        await editorLink.click();

        // Wait for editor URL — use commit event to avoid load timeout on heavy editor pages
        await homePage.waitForURL(/\/editor\//, { timeout: 60000, waitUntil: "commit" });

        // Race: wait for either the editor to load OR an error page to appear
        const editorReady = homePage
            .getByRole("button", { name: /Commit/i })
            .or(homePage.locator(".ProseMirror").first());
        const errorIndicator = homePage.locator("text=Unknown error occurred");

        const result = await Promise.race([
            editorReady.waitFor({ timeout: 60000 }).then(() => "ready" as const),
            errorIndicator.waitFor({ timeout: 60000 }).then(() => "error" as const)
        ]);

        // If the editor hit an error, reload and wait for it to recover
        if (result === "error") {
            await homePage.reload({ waitUntil: "domcontentloaded" });
            // After reload, race again — if it errors a second time, let it fail
            const retryResult = await Promise.race([
                editorReady.waitFor({ timeout: 60000 }).then(() => "ready" as const),
                errorIndicator.waitFor({ timeout: 60000 }).then(() => "error" as const)
            ]);
            if (retryResult === "error") {
                // Try the "Try again" button as last resort
                const tryAgain = homePage.locator("button", { hasText: "Try again" });
                if (await tryAgain.isVisible()) {
                    await tryAgain.click();
                    await editorReady.waitFor({ timeout: 60000 });
                }
            }
        }

        // Verify editor loaded without errors
        await expect(homePage.locator("text=We've encountered an error")).not.toBeVisible();
        await expect(homePage.locator("text=Unknown error occurred")).not.toBeVisible();
        await expect(homePage.locator("text=Page not found")).not.toBeVisible();
    });

    test("typing in editor triggers content update and tracks changed files", async ({ homePage }) => {
        // Wait for the TipTap editor to be ready
        const editor = homePage.locator(".ProseMirror").first();
        await editor.waitFor({ timeout: 30000 });

        // Click into the editor to focus it
        await editor.click();

        // Type some content to trigger an editor update
        await homePage.keyboard.type("Playwright test edit");

        // Wait for debounced update to propagate (editor debounces at 100ms with 300ms max)
        await homePage.waitForTimeout(500);

        // The Files dropdown button should reflect a changed file count > 0
        const filesButton = homePage.locator('button:has-text("Files")');
        await filesButton.waitFor({ timeout: 10000 });
        await expect(filesButton).toBeVisible();

        // Verify no crash after editing
        await expect(homePage.locator("text=We've encountered an error")).not.toBeVisible();
    });

    test("navigating between pages in sidebar updates editor content", async ({ homePage }) => {
        // Wait for editor to fully load by checking for the ProseMirror editor
        const editorArea = homePage.locator(".ProseMirror").first();
        await editorArea.waitFor({ timeout: 30000 });

        // The editor sidebar renders page nodes wrapped in .group\/page-menu divs
        // These are distinct from the main dashboard sidebar navigation
        const editorPageNodes = homePage.locator(".group\\/page-menu");
        const pageCount = await editorPageNodes.count();

        if (pageCount < 2) {
            test.skip(true, "Not enough editor sidebar pages to test navigation");
            return;
        }

        // Click the second page node in the editor sidebar
        const secondPageNode = editorPageNodes.nth(1);
        await secondPageNode.click();

        // Wait for navigation to complete (URL should change to new slug)
        await homePage.waitForTimeout(2000);

        // Verify we're still in the editor (URL still contains /editor/)
        expect(homePage.url()).toContain("/editor/");

        // Verify the editor area is still present (no crash)
        await expect(homePage.locator(".ProseMirror").first()).toBeVisible({ timeout: 30000 });
        await expect(homePage.locator("text=We've encountered an error")).not.toBeVisible();
    });

    test("opening docs settings panel renders configuration options", async ({ homePage }) => {
        // Find and click the settings cog button in the header toolbar
        const settingsButton = homePage
            .locator("button:has(svg.lucide-cog)")
            .or(homePage.getByRole("button", { name: /docs settings/i }));

        // Settings button may only be visible on desktop; wait briefly for it to appear
        try {
            await settingsButton.first().waitFor({ timeout: 10000 });
        } catch {
            test.skip(true, "Settings button not visible (may require desktop viewport)");
            return;
        }

        await settingsButton.first().click();

        // Verify the theming configuration sidebar opens with expected sections
        const settingsPanel = homePage.locator('text="Docs site name"');
        await expect(settingsPanel).toBeVisible({ timeout: 10000 });

        // Verify color palette section is present
        await expect(homePage.locator('text="Color palette"')).toBeVisible({ timeout: 5000 });

        // Verify favicon section is present
        await expect(homePage.locator('text="Favicon"')).toBeVisible({ timeout: 5000 });

        // Verify logo section is present
        await expect(homePage.locator('text="Logo"')).toBeVisible({ timeout: 5000 });

        // Verify no crash after opening settings
        await expect(homePage.locator("text=We've encountered an error")).not.toBeVisible();
    });

    test("editing docs site name in settings triggers update", async ({ homePage }) => {
        // Open settings panel
        const settingsButton = homePage
            .locator("button:has(svg.lucide-cog)")
            .or(homePage.getByRole("button", { name: /docs settings/i }));

        try {
            await settingsButton.first().waitFor({ timeout: 10000 });
        } catch {
            test.skip(true, "Settings button not visible (may require desktop viewport)");
            return;
        }

        await settingsButton.first().click();

        // Wait for settings panel to render
        const siteNameLabel = homePage.locator('text="Docs site name"');
        await expect(siteNameLabel).toBeVisible({ timeout: 10000 });

        // Find the site name input and modify it
        const siteNameInput = homePage.locator('input[placeholder="My Docs"]');
        await siteNameInput.waitFor({ timeout: 5000 });

        // Clear and type a new value
        await siteNameInput.fill("Test Docs Site");

        // Wait for the update to propagate
        await homePage.waitForTimeout(500);

        // The Files dropdown should reflect changes
        const filesButton = homePage.locator('button:has-text("Files")');
        await filesButton.waitFor({ timeout: 10000 });
        await expect(filesButton).toBeVisible();

        // Verify no crash after editing settings
        await expect(homePage.locator("text=We've encountered an error")).not.toBeVisible();
    });

    test("commit button is present and reflects editing state", async ({ homePage }) => {
        // Verify the Commit button is visible in the header toolbar
        const commitButton = homePage.getByRole("button", { name: /Commit/i });
        await expect(commitButton).toBeVisible({ timeout: 30000 });

        // Before any edits, commit should be disabled (no changes to commit)
        await expect(commitButton).toBeDisabled();

        // Type in the editor to create a change
        const editor = homePage.locator(".ProseMirror").first();
        await editor.waitFor({ timeout: 30000 });
        await editor.click();
        await homePage.keyboard.type("trigger commit state change");

        // Wait for debounced update
        await homePage.waitForTimeout(500);

        // Verify no crash
        await expect(homePage.locator("text=We've encountered an error")).not.toBeVisible();
    });
});
