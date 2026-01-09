// spec: Visual Editor - Edit Documentation Content
// seed: dashboard/seed.spec.ts

import { expect, test } from "../../../fixtures/auth.fixture";

test.describe("Visual Editor", () => {
    test("Edit Documentation Content", async ({ homePage: adminPage }) => {
        // 1. Login as admin user (already done by adminPage fixture)
        await expect(adminPage).toHaveURL(/.*\//);

        // 2. Navigate to a specific documentation site
        const docsSiteLink = adminPage
            .locator('a[href*="/docs/"]')
            .or(adminPage.locator("text=ci-test-site").or(adminPage.locator('[class*="docs"] a')))
            .first();

        await expect(docsSiteLink).toBeVisible({ timeout: 10000 });
        await docsSiteLink.click();

        await adminPage.waitForURL(/.*\/docs\//, { timeout: 10000 });

        // 3. Click 'New session' button to open visual editor
        const editorButton = adminPage
            .locator('button:has-text("New session")')
            .or(adminPage.locator('a:has-text("New session")'))
            .first();

        await expect(editorButton).toBeVisible({ timeout: 10000 });

        // Check if the button opens in a new tab
        const newPagePromise = adminPage
            .context()
            .waitForEvent("page", { timeout: 2000 })
            .catch(() => null);
        await editorButton.click();
        const newPage = await newPagePromise;

        // Use the new page if it was opened, otherwise use the current page
        const editorPage = newPage || adminPage;

        // 4. Wait for editor interface to load
        await editorPage.waitForURL(/.*\/editor\//);

        // 5. Locate the editor area
        const editorArea = editorPage
            .locator('[contenteditable="true"]')
            .or(
                editorPage
                    .locator('[role="textbox"]')
                    .or(
                        editorPage
                            .locator("textarea")
                            .or(editorPage.locator('[data-testid*="editor"]').or(editorPage.locator(".editor")))
                    )
            );

        // Verify editor area is present
        await expect(editorArea.first()).toBeVisible({ timeout: 20000 });

        // 6. Modify text content in the editor
        const editableElement = editorArea.first();

        // Click to focus the editor
        await editableElement.click();

        // Type some test content
        const testContent = "Test content added by Playwright automation";

        // Use keyboard to type content
        await editorPage.keyboard.press("End");
        await editorPage.keyboard.press("Enter");
        await editorPage.keyboard.type(testContent);

        // Verify the content was added
        await expect(editorPage.locator("body")).toContainText(testContent, { timeout: 10000 });

        // 7. Commit changes
        const commitButton = editorPage.locator('button:has-text("Commit")');

        // Verify commit button is present
        await expect(commitButton).toBeVisible({ timeout: 10000 });

        // Click the commit button
        await commitButton.click();

        // 8. Verify "What's next?" modal appears
        const whatsNextModal = editorPage.locator("text=What's next?");
        await expect(whatsNextModal).toBeVisible({ timeout: 200000 });

        // Close the modal by clicking outside of it or pressing Escape
        await editorPage.keyboard.press("Escape");

        // Wait for modal to close
        await expect(whatsNextModal).not.toBeVisible({ timeout: 5000 });

        // 9. Make another change
        await editableElement.click();
        const secondTestContent = "Second test content added";
        await editorPage.keyboard.press("End");
        await editorPage.keyboard.press("Enter");
        await editorPage.keyboard.type(secondTestContent);

        // Verify the second content was added
        await expect(editorPage.locator("body")).toContainText(secondTestContent, { timeout: 5000 });

        // 10. Commit changes again
        await expect(commitButton).toBeVisible({ timeout: 10000 });
        await commitButton.click();

        // Whats next should not be visible this time
        await expect(whatsNextModal).not.toBeVisible({ timeout: 10000 });

        // but a toast or confirmation should appear "Successfully committed changes!
        const successToast = editorPage.locator("text=Successfully committed changes");
        await expect(successToast).toBeVisible({ timeout: 10000 });

        // Expected Results:
        // - Content is editable in the visual editor
        // - Changes can be committed successfully
        // - "What's next?" modal appears after commit
        // - Multiple edits and commits work correctly
    });
});
