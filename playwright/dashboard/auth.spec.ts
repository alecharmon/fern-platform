import { expect, test } from "../fixtures/auth.fixture";

test.describe("Dashboard Authentication", () => {
    test("admin can log in and see dashboard", async ({ homePage: adminPage }) => {
        // Verify we're on the dashboard (auth state loaded from setup)
        await expect(adminPage).toHaveURL(/.*\//);

        // Verify some dashboard element is visible (adjust selector as needed)
        // This confirms the session is valid and we're not redirected to login
        await expect(adminPage.locator("body")).not.toContainText("Sign in");
    });
});
