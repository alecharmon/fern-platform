import { expect, test } from "../fixtures/auth.fixture";

test.describe("OIDC Group Mapping", () => {
    test("can create or update an OIDC group mapping from the members page", async ({ homePage, orgName }) => {
        test.setTimeout(60000);

        // Navigate to members page
        await homePage.goto(`/${orgName}/members`);
        await expect(homePage.getByText("Members").first()).toBeVisible({ timeout: 15000 });

        // Click the "Add OIDC Group Mapping" button
        const addButton = homePage.getByRole("button", { name: /Add OIDC Group Mapping/i });
        await expect(addButton).toBeVisible({ timeout: 10000 });
        await addButton.click();

        // Verify modal opens
        const dialog = homePage.getByRole("dialog", { name: /Add OIDC Group Mapping/i });
        await expect(dialog).toBeVisible({ timeout: 5000 });

        // Open the group name dropdown
        const combobox = dialog.getByRole("combobox", { name: /OIDC Group Name/i });
        await combobox.click();

        // Type "playwright-automated" in the search input
        const searchInput = dialog.getByPlaceholder("Search or add group");
        await expect(searchInput).toBeVisible();
        await searchInput.fill("playwright-automated");

        // Either select the existing group or create a new one
        const existingOption = dialog.getByRole("button", { name: "playwright-automated", exact: true });
        const createOption = dialog.getByRole("button", { name: /Create "playwright-automated"/ });

        // Wait for either option to appear and click it
        const option = await Promise.race([
            existingOption.waitFor({ timeout: 3000 }).then(() => existingOption),
            createOption.waitFor({ timeout: 3000 }).then(() => createOption),
        ]);
        await option.click();

        // Verify group was selected and resources section appeared
        await expect(combobox).toContainText("playwright-automated");
        await expect(dialog.getByText("Resources", { exact: true })).toBeVisible({ timeout: 5000 });

        // Wait for resources to finish loading
        await expect(dialog.getByText("Loading resources...")).not.toBeVisible({ timeout: 15000 });

        // Find the first resource's role dropdown and set it to "Viewer"
        const firstResourceDropdown = dialog.locator('[data-slot="select-trigger"]').first();
        await firstResourceDropdown.click();

        // Select "Viewer" from the dropdown options
        const viewerOption = homePage.getByRole("option", { name: "Viewer" });
        await expect(viewerOption).toBeVisible({ timeout: 3000 });
        await viewerOption.click();

        // Verify Save button is now enabled and click it
        const saveButton = dialog.getByRole("button", { name: "Save" });
        await expect(saveButton).toBeEnabled();
        await saveButton.click();

        // Verify modal closes (mapping saved successfully)
        await expect(dialog).not.toBeVisible({ timeout: 10000 });
    });
});
