import { expect, test } from "@playwright/test";
import { DOCS_URL, PASSWORDS } from "./helpers";

test.describe("Login Gating", () => {
    test("navigating to gated page shows login prompt", async ({ page }) => {
        await page.context().clearCookies();
        await page.goto(`${DOCS_URL}/docs/mixed-access/admin-only-page`);
        await expect(page).toHaveURL(/~login/);
        await expect(page.getByRole("heading", { name: "Password required" })).toBeVisible();
        await expect(page.getByText("You need a password to access this site.")).toBeVisible();
    });

    test("Continue button is disabled until password is entered", async ({ page }) => {
        await page.goto(`${DOCS_URL}/~login`);
        await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
        await page.getByRole("textbox", { name: "Enter password" }).fill("anything");
        await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
    });

    test("wrong password shows an error", async ({ page }) => {
        await page.goto(`${DOCS_URL}/~login`);
        await page.getByRole("textbox", { name: "Enter password" }).fill("wrong-password-xyz");
        await page.getByRole("button", { name: "Continue" }).click();
        // Should stay on login page or show error
        await expect(page).toHaveURL(/~login/);
    });

    test("correct password grants access and shows docs content", async ({ page }) => {
        await page.goto(`${DOCS_URL}/~login`);
        await page.getByRole("textbox", { name: "Enter password" }).fill(PASSWORDS.admin);
        await page.getByRole("button", { name: "Continue" }).click();
        await page.waitForURL((url) => !url.pathname.includes("~login"));
        await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
    });

    test("gated page returnTo param redirects after login", async ({ page }) => {
        await page.context().clearCookies();
        // Visit a gated page unauthenticated
        await page.goto(`${DOCS_URL}/docs/mixed-access/admin-only-page`);
        await expect(page).toHaveURL(/~login.*returnTo/);
        // Login
        await page.getByRole("textbox", { name: "Enter password" }).fill(PASSWORDS.admin);
        await page.getByRole("button", { name: "Continue" }).click();
        // Should redirect back to the originally requested page
        await expect(page).toHaveURL(/admin-only-page/);
        await expect(page.getByRole("heading", { name: "Admin Only Page" })).toBeVisible();
    });
});
