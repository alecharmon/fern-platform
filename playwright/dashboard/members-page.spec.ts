import { expect, test } from "../fixtures/auth.fixture";

test.describe("Members Page", () => {
    test("members page loads and displays member list", async ({ homePage }) => {
        const orgName = new URL(homePage.url()).pathname.split("/").filter(Boolean)[0];
        expect(orgName).toBeTruthy();

        await homePage.goto(`/${orgName}/members`);

        // Verify no error page
        await expect(homePage.locator("text=We've encountered an error")).not.toBeVisible();

        // Verify the members heading is visible
        await expect(homePage.getByText("Members").first()).toBeVisible({ timeout: 15000 });

        // Verify "Add member" button is visible
        await expect(homePage.getByRole("button", { name: /Add member/i })).toBeVisible();

        // Verify at least one member entry is displayed
        await expect(homePage.getByText("@").first()).toBeVisible({ timeout: 15000 });
    });
});
