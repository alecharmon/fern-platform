/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks (must come before imports of the component under test) ---

const mockGetPasswordProtection = vi.fn();
const mockSetPasswordProtection = vi.fn();
const mockRemovePasswordProtection = vi.fn();

vi.mock("@/app/services/dashboard-api/client", () => ({
    DashboardApiClient: {
        getPasswordProtection: (...args: unknown[]) => mockGetPasswordProtection(...args),
        setPasswordProtection: (...args: unknown[]) => mockSetPasswordProtection(...args),
        removePasswordProtection: (...args: unknown[]) => mockRemovePasswordProtection(...args)
    }
}));

const mockUseEntitlement = vi.fn();
vi.mock("@/state/useEntitlement", () => ({
    useEntitlement: (key: string) => mockUseEntitlement(key)
}));

const mockOpenUpsell = vi.fn();
vi.mock("@/components/upsells", () => ({
    useUpsell: () => ({ openUpsell: mockOpenUpsell, closeUpsell: vi.fn(), isOpen: false, activeFeature: null })
}));

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

// --- Component under test ---
import { PasswordProtectionSettingsCard } from "../PasswordProtectionSettingsCard";

// --- Helpers ---

const DEFAULT_PROPS = {
    docsUrl: "test.docs.buildwithfern.com" as any,
    orgName: "test-org" as any
};

function renderCard(props = {}) {
    return render(<PasswordProtectionSettingsCard {...DEFAULT_PROPS} {...props} />);
}

// --- Tests ---

describe("PasswordProtectionSettingsCard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseEntitlement.mockReturnValue({ isEntitled: true, isLoading: false });
        mockGetPasswordProtection.mockResolvedValue({
            password: null,
            passwords: null,
            lastUpdatedAt: null,
            lastUpdatedBy: null
        });
    });

    describe("initial render", () => {
        it("renders the card title and description for no-password state", async () => {
            renderCard();

            await waitFor(() => {
                expect(screen.getByText("Password")).toBeDefined();
                expect(screen.getByText("Protect your published site with a password.")).toBeDefined();
            });
        });

        it("shows password input when no password is set", async () => {
            renderCard();

            await waitFor(() => {
                expect(screen.getByPlaceholderText("Add a password")).toBeDefined();
            });
        });

        it("shows existing password when one is set", async () => {
            mockGetPasswordProtection.mockResolvedValue({
                password: "mysecret",
                passwords: null,
                lastUpdatedAt: "2026-03-18T12:00:00.000Z",
                lastUpdatedBy: "Test User"
            });

            renderCard();

            await waitFor(() => {
                expect(screen.getByText("Your site is currently password protected.")).toBeDefined();
            });
        });

        it("shows role rows when roles are configured", async () => {
            mockGetPasswordProtection.mockResolvedValue({
                password: null,
                passwords: [
                    { password: "adminpass", roles: ["admin"] },
                    { password: "viewerpass", roles: ["viewer"] }
                ],
                lastUpdatedAt: "2026-03-18T12:00:00.000Z",
                lastUpdatedBy: "Test User"
            });

            renderCard();

            await waitFor(() => {
                expect(screen.getAllByText("Role:").length).toBe(2);
                expect(screen.getByText("admin")).toBeDefined();
                expect(screen.getByText("viewer")).toBeDefined();
            });
        });
    });

    describe("save password", () => {
        it("disables Save button when input is empty", async () => {
            renderCard();

            await waitFor(() => {
                expect(screen.getByPlaceholderText("Add a password")).toBeDefined();
            });

            const saveButton = screen.getByRole("button", { name: "Save" });
            expect(saveButton).toBeDefined();
            expect((saveButton as HTMLButtonElement).disabled).toBe(true);
        });

        it("enables Save button when input has value", async () => {
            renderCard();

            await waitFor(() => {
                expect(screen.getByPlaceholderText("Add a password")).toBeDefined();
            });

            const input = screen.getByPlaceholderText("Add a password");
            fireEvent.change(input, { target: { value: "test123" } });

            const saveButton = screen.getByRole("button", { name: "Save" });
            expect((saveButton as HTMLButtonElement).disabled).toBe(false);
        });
    });

    describe("roles modal", () => {
        it("opens roles dialog when Add roles is clicked", async () => {
            renderCard();

            await waitFor(() => {
                expect(screen.getByPlaceholderText("Add a password")).toBeDefined();
            });

            fireEvent.click(screen.getByRole("button", { name: "Add roles" }));

            await waitFor(() => {
                expect(screen.getByText("Add roles", { selector: "[data-slot='dialog-title']" })).toBeDefined();
                expect(
                    screen.getByText(/Visitors who enter a specific password will be assigned the corresponding role/)
                ).toBeDefined();
                expect(screen.getByText(/You can define up to 3 roles/)).toBeDefined();
            });
        });

        it("shows RBAC docs link in the modal", async () => {
            renderCard();

            await waitFor(() => {
                expect(screen.getByPlaceholderText("Add a password")).toBeDefined();
            });

            fireEvent.click(screen.getByRole("button", { name: "Add roles" }));

            await waitFor(() => {
                const link = screen.getByText(/Learn about Fern.*s RBAC here/);
                expect(link).toBeDefined();
                expect(link.closest("a")?.href).toContain("buildwithfern.com/learn/docs/authentication/features/rbac");
            });
        });

        it("shows placeholder text in first row", async () => {
            renderCard();

            await waitFor(() => {
                expect(screen.getByPlaceholderText("Add a password")).toBeDefined();
            });

            fireEvent.click(screen.getByRole("button", { name: "Add roles" }));

            await waitFor(() => {
                expect(screen.getByPlaceholderText("admin")).toBeDefined();
                expect(screen.getByPlaceholderText("adminpass123")).toBeDefined();
            });
        });

        it("adds a new row when Add another is clicked", async () => {
            renderCard();

            await waitFor(() => {
                expect(screen.getByPlaceholderText("Add a password")).toBeDefined();
            });

            fireEvent.click(screen.getByRole("button", { name: "Add roles" }));

            await waitFor(() => {
                expect(screen.getByPlaceholderText("admin")).toBeDefined();
            });

            fireEvent.click(screen.getByText("Add another"));

            expect(screen.getByPlaceholderText("Enter role")).toBeDefined();
            expect(screen.getByPlaceholderText("Enter password")).toBeDefined();
        });

        it("disables Add another button when 3 roles are defined", async () => {
            renderCard();

            await waitFor(() => {
                expect(screen.getByPlaceholderText("Add a password")).toBeDefined();
            });

            fireEvent.click(screen.getByRole("button", { name: "Add roles" }));

            await waitFor(() => {
                expect(screen.getByPlaceholderText("admin")).toBeDefined();
            });

            // Add 2 more rows (total 3)
            fireEvent.click(screen.getByText("Add another"));
            fireEvent.click(screen.getByText("Add another"));

            const addButton = screen.getByText("Add another").closest("button");
            expect(addButton).toBeDefined();
            expect(addButton!.disabled).toBe(true);
        });

        it("removes a row when trash icon is clicked", async () => {
            renderCard();

            await waitFor(() => {
                expect(screen.getByPlaceholderText("Add a password")).toBeDefined();
            });

            fireEvent.click(screen.getByRole("button", { name: "Add roles" }));

            await waitFor(() => {
                expect(screen.getByPlaceholderText("admin")).toBeDefined();
            });

            // Add a second row
            fireEvent.click(screen.getByText("Add another"));
            expect(screen.getByPlaceholderText("Enter role")).toBeDefined();

            // Both rows now have trash icons — find buttons with svg inside the grid rows
            const trashButtons = screen.getAllByRole("button").filter((btn) => {
                return btn.querySelector("svg.lucide-trash-2, svg[class*='lucide-trash']") != null;
            });

            // If we can't find by svg class, find by position in grid
            if (trashButtons.length === 0) {
                // There should be 2 role input rows and 2 placeholder inputs ("Enter role", "Enter password")
                const enterRoleInput = screen.getByPlaceholderText("Enter role");
                expect(enterRoleInput).toBeDefined();

                // Remove the second row by finding the trash button near it
                const gridRows = document.querySelectorAll(".grid.grid-cols-\\[1fr_1fr_32px\\]");
                const lastRow = gridRows[gridRows.length - 1];
                const trashBtn = lastRow?.querySelector("button");
                if (trashBtn) {
                    fireEvent.click(trashBtn);
                }
            } else {
                expect(trashButtons.length).toBe(2);
                fireEvent.click(trashButtons[1]!);
            }

            // After removal, "Enter role" placeholder should be gone (only first row with "admin" placeholder remains)
            expect(screen.queryByPlaceholderText("Enter role")).toBeNull();
        });

        it("shows warning when standalone password exists and opening roles modal", async () => {
            mockGetPasswordProtection.mockResolvedValue({
                password: "existingpass",
                passwords: null,
                lastUpdatedAt: "2026-03-18T12:00:00.000Z",
                lastUpdatedBy: "Test User"
            });

            renderCard();

            await waitFor(() => {
                expect(screen.getByText("Your site is currently password protected.")).toBeDefined();
            });

            fireEvent.click(screen.getByRole("button", { name: "Add roles" }));

            await waitFor(() => {
                expect(screen.getByText("Saving roles will replace your existing site password.")).toBeDefined();
            });
        });

        it("does not show warning when editing existing roles", async () => {
            mockGetPasswordProtection.mockResolvedValue({
                password: null,
                passwords: [{ password: "adminpass", roles: ["admin"] }],
                lastUpdatedAt: "2026-03-18T12:00:00.000Z",
                lastUpdatedBy: "Test User"
            });

            renderCard();

            await waitFor(() => {
                expect(screen.getByText("admin")).toBeDefined();
            });

            fireEvent.click(screen.getByText("Edit roles"));

            await waitFor(() => {
                expect(screen.queryByText("Saving roles will replace your existing site password.")).toBeNull();
            });
        });

        it("saves roles and shows success toast", async () => {
            const { toast } = await import("sonner");
            mockSetPasswordProtection.mockResolvedValue({
                success: true,
                lastUpdatedAt: "2026-03-18T12:00:00.000Z",
                lastUpdatedBy: "Test User"
            });

            renderCard();

            await waitFor(() => {
                expect(screen.getByPlaceholderText("Add a password")).toBeDefined();
            });

            fireEvent.click(screen.getByRole("button", { name: "Add roles" }));

            await waitFor(() => {
                expect(screen.getByPlaceholderText("admin")).toBeDefined();
            });

            // Fill in role and password
            fireEvent.change(screen.getByPlaceholderText("admin"), { target: { value: "editor" } });
            fireEvent.change(screen.getByPlaceholderText("adminpass123"), { target: { value: "editorpass" } });

            fireEvent.click(screen.getByRole("button", { name: "Save roles" }));

            await waitFor(() => {
                expect(mockSetPasswordProtection).toHaveBeenCalledWith({
                    orgName: "test-org",
                    docsUrl: "test.docs.buildwithfern.com",
                    passwords: [{ password: "editorpass", roles: ["editor"] }]
                });
            });

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalledWith(
                    "Roles saved. Locking down your site. This will take up to 30 minutes to complete."
                );
            });
        });

        it("sends only passwords (no standalone password) when saving roles", async () => {
            mockSetPasswordProtection.mockResolvedValue({
                success: true,
                lastUpdatedAt: "2026-03-18T12:00:00.000Z",
                lastUpdatedBy: "Test User"
            });

            renderCard();

            await waitFor(() => {
                expect(screen.getByPlaceholderText("Add a password")).toBeDefined();
            });

            fireEvent.click(screen.getByRole("button", { name: "Add roles" }));

            await waitFor(() => {
                expect(screen.getByPlaceholderText("admin")).toBeDefined();
            });

            fireEvent.change(screen.getByPlaceholderText("admin"), { target: { value: "admin" } });
            fireEvent.change(screen.getByPlaceholderText("adminpass123"), { target: { value: "secret" } });

            fireEvent.click(screen.getByRole("button", { name: "Save roles" }));

            await waitFor(() => {
                const call = mockSetPasswordProtection.mock.calls[0]?.[0];
                expect(call).toBeDefined();
                // Should have passwords but NOT a standalone password field
                expect(call.passwords).toBeDefined();
                expect(call.password).toBeUndefined();
            });
        });
    });

    describe("upsell gate", () => {
        it("opens upsell when Save is clicked without entitlement", async () => {
            mockUseEntitlement.mockReturnValue({ isEntitled: false, isLoading: false });

            renderCard();

            await waitFor(() => {
                expect(screen.getByPlaceholderText("Add a password")).toBeDefined();
            });

            const input = screen.getByPlaceholderText("Add a password");
            fireEvent.change(input, { target: { value: "test123" } });
            fireEvent.click(screen.getByRole("button", { name: "Save" }));

            expect(mockOpenUpsell).toHaveBeenCalledWith("password_protection");
            expect(mockSetPasswordProtection).not.toHaveBeenCalled();
        });

        it("opens upsell when Add roles is clicked without entitlement", async () => {
            mockUseEntitlement.mockReturnValue({ isEntitled: false, isLoading: false });

            renderCard();

            await waitFor(() => {
                expect(screen.getByPlaceholderText("Add a password")).toBeDefined();
            });

            fireEvent.click(screen.getByRole("button", { name: "Add roles" }));

            expect(mockOpenUpsell).toHaveBeenCalledWith("password_protection");
        });
    });

    describe("remove password", () => {
        it("shows confirmation dialog when Remove is clicked", async () => {
            mockGetPasswordProtection.mockResolvedValue({
                password: "existingpass",
                passwords: null,
                lastUpdatedAt: "2026-03-18T12:00:00.000Z",
                lastUpdatedBy: "Test User"
            });

            renderCard();

            await waitFor(() => {
                expect(screen.getByText("Your site is currently password protected.")).toBeDefined();
            });

            fireEvent.click(screen.getByRole("button", { name: "Remove" }));

            await waitFor(() => {
                expect(screen.getByText("Remove password protection?")).toBeDefined();
                expect(
                    screen.getByText(
                        "Are you sure you want to remove password protection? Your site will become publicly accessible."
                    )
                ).toBeDefined();
            });
        });
    });

    describe("remove roles via Remove button", () => {
        it("opens remove dialog and calls removePasswordProtection when roles are configured", async () => {
            const { toast } = await import("sonner");
            mockGetPasswordProtection.mockResolvedValue({
                password: null,
                passwords: [{ password: "adminpass", roles: ["admin"] }],
                lastUpdatedAt: "2026-03-18T12:00:00.000Z",
                lastUpdatedBy: "Test User"
            });
            mockRemovePasswordProtection.mockResolvedValue({ success: true });

            renderCard();

            await waitFor(() => {
                expect(screen.getByText("admin")).toBeDefined();
            });

            // In has-password + hasRoles state, click Remove button
            fireEvent.click(screen.getByRole("button", { name: "Remove" }));

            await waitFor(() => {
                expect(screen.getByText("Remove password protection?")).toBeDefined();
            });

            // Confirm removal in the dialog
            const removeButtons = screen.getAllByRole("button", { name: "Remove" });
            const confirmRemoveButton = removeButtons.find((btn) => btn.closest("[role='dialog']") != null);
            expect(confirmRemoveButton).toBeDefined();
            fireEvent.click(confirmRemoveButton!);

            await waitFor(() => {
                expect(mockRemovePasswordProtection).toHaveBeenCalledWith({
                    orgName: "test-org",
                    docsUrl: "test.docs.buildwithfern.com"
                });
            });

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalledWith(
                    "Password protection removed. This will take up to 30 minutes to complete."
                );
            });
        });
    });
});
