/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type ExistingGroupMapping, OidcGroupMappingModal } from "./OidcGroupMappingModal";

// Mock next/font/local
vi.mock("next/font/local", () => ({
    default: () => ({
        className: "mock-font",
        style: { fontFamily: "mock-font" }
    })
}));

const RESOURCES = [
    { id: "docs-1", label: "docs.acme.com" },
    { id: "docs-2", label: "api.acme.com" }
];

const GROUP_NAMES = ["engineering", "design", "product"];

describe("OidcGroupMappingModal", () => {
    const defaultProps = {
        open: true,
        onOpenChange: vi.fn(),
        onSave: vi.fn(),
        resources: RESOURCES,
        existingGroupNames: GROUP_NAMES,
        existingMappings: [] as ExistingGroupMapping[]
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("group name selection", () => {
        it("renders the group name combobox", () => {
            render(<OidcGroupMappingModal {...defaultProps} />);
            expect(screen.getByRole("combobox", { name: /OIDC Group Name/i })).toBeDefined();
        });

        it("opens dropdown and shows existing groups on click", () => {
            render(<OidcGroupMappingModal {...defaultProps} />);
            fireEvent.click(screen.getByRole("combobox", { name: /OIDC Group Name/i }));

            expect(screen.getByPlaceholderText("Search or add group")).toBeDefined();
            expect(screen.getByRole("button", { name: "engineering" })).toBeDefined();
            expect(screen.getByRole("button", { name: "design" })).toBeDefined();
            expect(screen.getByRole("button", { name: "product" })).toBeDefined();
        });

        it("shows create option when typing a new name", () => {
            render(<OidcGroupMappingModal {...defaultProps} />);
            fireEvent.click(screen.getByRole("combobox", { name: /OIDC Group Name/i }));

            const input = screen.getByPlaceholderText("Search or add group");
            fireEvent.change(input, { target: { value: "new-group" } });

            expect(screen.getByRole("button", { name: /Create "new-group"/ })).toBeDefined();
        });

        it("filters groups when searching", () => {
            render(<OidcGroupMappingModal {...defaultProps} />);
            fireEvent.click(screen.getByRole("combobox", { name: /OIDC Group Name/i }));

            const input = screen.getByPlaceholderText("Search or add group");
            fireEvent.change(input, { target: { value: "eng" } });

            expect(screen.getByRole("button", { name: "engineering" })).toBeDefined();
            expect(screen.queryByRole("button", { name: "design" })).toBeNull();
        });

        it("selects a group and shows role selection", () => {
            render(<OidcGroupMappingModal {...defaultProps} />);
            fireEvent.click(screen.getByRole("combobox", { name: /OIDC Group Name/i }));
            fireEvent.click(screen.getByRole("button", { name: "engineering" }));

            // Combobox should show selected name
            expect(screen.getByRole("combobox", { name: /OIDC Group Name/i }).textContent).toContain("engineering");

            // Access type selector should be visible
            expect(screen.getByText("Access Type")).toBeDefined();
        });
    });

    describe("access type selection", () => {
        it("defaults to org-level access", () => {
            render(<OidcGroupMappingModal {...defaultProps} />);
            fireEvent.click(screen.getByRole("combobox", { name: /OIDC Group Name/i }));
            fireEvent.click(screen.getByRole("button", { name: "engineering" }));

            const orgRadio = screen.getByLabelText(/Organization-level access/i) as HTMLInputElement;
            expect(orgRadio.checked).toBe(true);
        });

        it("shows org role selector in org-level mode", () => {
            render(<OidcGroupMappingModal {...defaultProps} />);
            fireEvent.click(screen.getByRole("combobox", { name: /OIDC Group Name/i }));
            fireEvent.click(screen.getByRole("button", { name: "engineering" }));

            // Should show role dropdown with "Viewer" default
            expect(screen.getByText("Viewer")).toBeDefined();
        });

        it("shows resource list when switching to fine-grained", () => {
            render(<OidcGroupMappingModal {...defaultProps} />);
            fireEvent.click(screen.getByRole("combobox", { name: /OIDC Group Name/i }));
            fireEvent.click(screen.getByRole("button", { name: "engineering" }));

            // Switch to fine-grained
            const fineGrainedRadio = screen.getByLabelText(/Fine-grained access/i);
            fireEvent.click(fineGrainedRadio);

            // Should show resources
            expect(screen.getByText("docs.acme.com")).toBeDefined();
            expect(screen.getByText("api.acme.com")).toBeDefined();
        });
    });

    describe("pre-fill from existing mappings", () => {
        it("pre-fills org-level role when selecting group with org_role mapping", () => {
            const mappings: ExistingGroupMapping[] = [
                { groupId: "engineering", mappingType: "org_role", role: "admin" }
            ];

            render(<OidcGroupMappingModal {...defaultProps} existingMappings={mappings} />);
            fireEvent.click(screen.getByRole("combobox", { name: /OIDC Group Name/i }));
            fireEvent.click(screen.getByRole("button", { name: "engineering" }));

            // Should be in org mode with admin selected
            const orgRadio = screen.getByLabelText(/Organization-level access/i) as HTMLInputElement;
            expect(orgRadio.checked).toBe(true);
            expect(screen.getByText("Admin")).toBeDefined();
        });

        it("pre-fills fine-grained roles when selecting group with resource_role mappings", () => {
            const mappings: ExistingGroupMapping[] = [
                { groupId: "design", mappingType: "resource_role", role: "editor", resourceId: "docs-1" },
                { groupId: "design", mappingType: "resource_role", role: "viewer", resourceId: "docs-2" }
            ];

            render(<OidcGroupMappingModal {...defaultProps} existingMappings={mappings} />);
            fireEvent.click(screen.getByRole("combobox", { name: /OIDC Group Name/i }));
            fireEvent.click(screen.getByRole("button", { name: "design" }));

            // Should be in fine-grained mode
            const fineGrainedRadio = screen.getByLabelText(/Fine-grained access/i) as HTMLInputElement;
            expect(fineGrainedRadio.checked).toBe(true);
        });
    });

    describe("save validation", () => {
        it("save button is disabled when no group is selected", () => {
            render(<OidcGroupMappingModal {...defaultProps} />);

            const dialog = screen.getByRole("dialog");
            const saveButton = within(dialog).getByRole("button", { name: "Save" });
            expect(saveButton).toHaveProperty("disabled", true);
        });

        it("save button is enabled with org-level role selected", () => {
            render(<OidcGroupMappingModal {...defaultProps} />);

            // Select a group (defaults to org-level with viewer role)
            fireEvent.click(screen.getByRole("combobox", { name: /OIDC Group Name/i }));
            fireEvent.click(screen.getByRole("button", { name: "engineering" }));

            const dialog = screen.getByRole("dialog");
            const saveButton = within(dialog).getByRole("button", { name: "Save" });
            expect(saveButton).toHaveProperty("disabled", false);
        });

        it("save button is disabled in saving state", () => {
            render(<OidcGroupMappingModal {...defaultProps} isSaving={true} />);

            const dialog = screen.getByRole("dialog");
            const saveButton = within(dialog).getByRole("button", { name: "Save" });
            expect(saveButton).toHaveProperty("disabled", true);
        });

        it("calls onSave with org-level data", () => {
            const onSave = vi.fn();
            render(<OidcGroupMappingModal {...defaultProps} onSave={onSave} />);

            // Select group
            fireEvent.click(screen.getByRole("combobox", { name: /OIDC Group Name/i }));
            fireEvent.click(screen.getByRole("button", { name: "engineering" }));

            // Click save
            const dialog = screen.getByRole("dialog");
            fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

            expect(onSave).toHaveBeenCalledWith(
                expect.objectContaining({
                    groupName: "engineering",
                    accessType: "org",
                    orgRole: "viewer"
                })
            );
        });
    });

    describe("warning banner", () => {
        it("displays session invalidation warning", () => {
            render(<OidcGroupMappingModal {...defaultProps} />);
            expect(screen.getByText(/log out all other members/i)).toBeDefined();
        });
    });

    describe("state reset", () => {
        it("resets all state when modal closes", () => {
            const { rerender } = render(<OidcGroupMappingModal {...defaultProps} />);

            // Select a group
            fireEvent.click(screen.getByRole("combobox", { name: /OIDC Group Name/i }));
            fireEvent.click(screen.getByRole("button", { name: "engineering" }));

            // Close and reopen
            rerender(<OidcGroupMappingModal {...defaultProps} open={false} />);
            rerender(<OidcGroupMappingModal {...defaultProps} open={true} />);

            // Should be back to placeholder
            expect(screen.getByRole("combobox", { name: /OIDC Group Name/i }).textContent).toContain(
                "Select or create an OIDC group"
            );
        });
    });
});
