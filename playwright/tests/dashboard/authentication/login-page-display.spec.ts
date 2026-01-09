// spec: Authentication - Login Page Display and Elements
// This test verifies the login page displays correctly with all expected elements

import { expect, test } from "@playwright/test";
import { env } from "../../../utils/env";

test.describe("Authentication", () => {
    test("Login Page Display and Elements", async ({ page }) => {
        // 1. Navigate to login page
        await page.goto(`${env.dashboardUrl}/login`);

        // 2. Verify 'Log in to Fern' heading is visible
        await expect(page.locator("text=Log in to Fern")).toBeVisible();

        // 3. Verify Google login button is present
        await expect(page.getByRole("link", { name: /Continue with Google/i })).toBeVisible();

        // 4. Verify GitHub login button is present
        await expect(page.getByRole("link", { name: /Continue with GitHub/i })).toBeVisible();

        // 5. Verify Email login form is visible
        await expect(page.getByPlaceholder("Enter email address")).toBeVisible();
        await expect(page.getByRole("button", { name: /Continue/i, exact: false })).toBeVisible();

        // 6. Verify 'Documentation' link in top-right corner is present
        await expect(page.getByRole("link", { name: /Documentation/i })).toBeVisible();

        // 7. Verify Terms of Service link is present
        await expect(page.getByRole("link", { name: /Terms of Service/i })).toBeVisible();

        // 8. Verify Privacy Policy link is present
        await expect(page.getByRole("link", { name: /Privacy Policy/i })).toBeVisible();

        // 9. Verify theme toggle button is visible (desktop only)
        // The ThemeToggle has className "hidden md:flex", so it's only visible on desktop
        const viewportSize = page.viewportSize();
        if (viewportSize && viewportSize.width >= 768) {
            // Theme toggle is present in the DOM but may not have a specific accessible name
            // Check for its presence in the top-right corner area
            const themeToggle = page.locator(".absolute.right-4.top-4 button").first();
            await expect(themeToggle).toBeVisible();
        }
    });
});
