import { expect, test } from "../fixtures/auth.fixture";

test.describe("Dashboard Authentication", () => {
    test("admin can log in and see dashboard", async ({ homePage }) => {
        await expect(homePage).toHaveURL(/.*\//);
        await expect(homePage.locator("body")).not.toContainText("Sign in");
    });
});
