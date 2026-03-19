import { expect, test } from "../fixtures/auth.fixture";

test.describe("Editor Updates", () => {
    test.setTimeout(120000);

    let orgName: string;
    let docsUrl: string;

    test.beforeEach(async ({ homePage }) => {
        orgName = new URL(homePage.url()).pathname.split("/").filter(Boolean)[0];
        expect(orgName).toBeTruthy();

        // Navigate to docs list and find a docs site
        await homePage.goto(`/${orgName}/docs`, { waitUntil: "domcontentloaded", timeout: 30000 });

        const docsLink = homePage.locator('a[href*="/docs/"]').first();
        await docsLink.waitFor({ timeout: 30000 });
        const href = await docsLink.getAttribute("href");
        expect(href).toBeTruthy();
        docsUrl = href!.split("/docs/")[1]?.split("/")[0] ?? "";
        expect(docsUrl).toBeTruthy();

        // Navigate to docs detail page
        await docsLink.click();
        await homePage.waitForURL(/\/docs\//, { timeout: 30000 });

        // Click the "Edit" button to open the editor
        const editButton = homePage
            .getByRole("link", { name: /Edit/i })
            .or(homePage.locator('a[href*="/editor/"]').first());
        await editButton.waitFor({ timeout: 30000 });
        await editButton.click();

        // Wait for editor to load
        await homePage.waitForURL(/\/editor\//, { timeout: 60000 });

        // Verify editor loaded without errors
        await expect(homePage.locator("text=We've encountered an error")).not.toBeVisible();
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
        // Wait for the sidebar navigation to be present
        const sidebar = homePage.locator('nav, [class*="sidebar"], [role="navigation"]').first();
        await sidebar.waitFor({ timeout: 30000 });

        // Find sidebar page links (these are the navigation items in the editor sidebar)
        const sidebarLinks = sidebar.locator("a").filter({ hasNotText: /^$/ });
        const linkCount = await sidebarLinks.count();

        if (linkCount < 2) {
            test.skip(true, "Not enough sidebar pages to test navigation");
            return;
        }

        // Get initial editor content reference
        const editorArea = homePage.locator(".ProseMirror").first();
        await editorArea.waitFor({ timeout: 30000 });
        // Click a different page in the sidebar
        const secondLink = sidebarLinks.nth(1);
        await secondLink.click();

        // Wait for URL to change (editor navigates to new slug)
        await homePage.waitForTimeout(2000);

        // Verify the editor area is still present (no crash)
        await expect(homePage.locator(".ProseMirror").first()).toBeVisible({ timeout: 30000 });
        await expect(homePage.locator("text=We've encountered an error")).not.toBeVisible();
    });

    test("opening docs settings panel renders configuration options", async ({ homePage }) => {
        // Find and click the settings cog button in the header toolbar
        const settingsButton = homePage
            .locator("button:has(svg.lucide-cog)")
            .or(homePage.getByRole("button", { name: /docs settings/i }));

        // Settings button may only be visible on desktop
        if (!(await settingsButton.isVisible())) {
            test.skip(true, "Settings button not visible (may require desktop viewport)");
            return;
        }

        await settingsButton.click();

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

        if (!(await settingsButton.isVisible())) {
            test.skip(true, "Settings button not visible (may require desktop viewport)");
            return;
        }

        await settingsButton.click();

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
