// spec: Visual Editor - Access Visual Editor
// seed: dashboard/seed.spec.ts

import { expect, test } from "../../../fixtures/auth.fixture";

test.describe("Visual Editor", () => {
    test("Access Visual Editor", async ({ homePage: adminPage }) => {
        // 1. Login as admin user (already done by adminPage fixture)
        await expect(adminPage).toHaveURL(/.*\//);

        // 2. Navigate to a specific documentation site
        // Click on the docs site link in the sidebar (e.g., "ci-test-site.docs.buildw...")
        const docsSiteLink = adminPage
            .locator('a[href*="/docs/"]')
            .or(adminPage.locator("text=ci-test-site").or(adminPage.locator('[class*="docs"] a')))
            .first();

        await expect(docsSiteLink).toBeVisible({ timeout: 10000 });
        await docsSiteLink.click();

        // Wait for docs site detail page to load
        await adminPage.waitForURL(/.*\/docs\//, { timeout: 10000 });

        // 3. Click 'New session' button to open visual editor
        const editorButton = adminPage
            .locator('button:has-text("New session")')
            .or(adminPage.locator('a:has-text("New session")'))
            .first();

        // Expected Results: Visual editor loads successfully
        await expect(editorButton).toBeVisible({ timeout: 10000 });
        await editorButton.click();

        // 4. Verify editor interface loads
        await adminPage.waitForURL(/.*\/editor\//, { timeout: 30000 });

        // Check for sidebar/navigation panel
        const sidebar = adminPage
            .locator('[role="navigation"]')
            .or(
                adminPage
                    .locator("aside")
                    .or(
                        adminPage
                            .locator('[class*="sidebar"]')
                            .or(adminPage.locator('[class*="nav"]').or(adminPage.locator('[data-testid*="sidebar"]')))
                    )
            );

        // Expected Results: All editor components (sidebar, main editor, preview) are visible
        await expect(sidebar.first()).toBeVisible({ timeout: 10000 });

        // Check for main editor area
        const editorArea = adminPage
            .locator('[class*="editor"]')
            .or(
                adminPage
                    .locator('[role="textbox"]')
                    .or(
                        adminPage
                            .locator("textarea")
                            .or(
                                adminPage
                                    .locator('[contenteditable="true"]')
                                    .or(adminPage.locator('[data-testid*="editor"]'))
                            )
                    )
            );
        await expect(editorArea.first()).toBeVisible({ timeout: 10000 });

        // Check for toolbar
        const toolbar = adminPage
            .locator('[role="toolbar"]')
            .or(
                adminPage
                    .locator('[class*="toolbar"]')
                    .or(adminPage.locator("header").or(adminPage.locator('[data-testid*="toolbar"]')))
            );
        await expect(toolbar.first()).toBeVisible({ timeout: 10000 });

        // Expected Results: Editor is ready for content manipulation
        // Verify no loading spinners or error messages
        const loadingSpinner = adminPage
            .locator('[role="progressbar"]')
            .or(adminPage.locator('[class*="loading"]').or(adminPage.locator('[class*="spinner"]')));
        await expect(loadingSpinner).not.toBeVisible({ timeout: 5000 });

        // Verify no error messages are displayed
        const pageContent = adminPage.locator("body");
        await expect(pageContent).not.toContainText("404");
        await expect(pageContent).not.toContainText("Not Found");
        await expect(pageContent).not.toContainText("Something went wrong");
        await expect(pageContent).not.toContainText("Failed to load");
    });
});
