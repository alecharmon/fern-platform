/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RoleSelectionGroup, type UserRole } from "./RoleSelection";

// Mock next/font/local
vi.mock("next/font/local", () => ({
    default: () => ({
        className: "mock-font",
        style: { fontFamily: "mock-font" }
    })
}));

describe("RoleSelectionGroup", () => {
    const defaultProps = {
        role: "editor" as UserRole,
        onRoleChange: vi.fn(),
        cliEnabled: false,
        onCliEnabledChange: vi.fn(),
        disabled: false
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("org-level role selection", () => {
        it("renders role selector with current role", () => {
            render(<RoleSelectionGroup {...defaultProps} role="editor" />);

            expect(screen.getByRole("combobox")).toBeDefined();
            expect(screen.getByText("Editor")).toBeDefined();
        });

        it("calls onRoleChange when role is changed", () => {
            const onRoleChange = vi.fn();
            render(<RoleSelectionGroup {...defaultProps} onRoleChange={onRoleChange} role="editor" />);

            const select = screen.getByRole("combobox");
            fireEvent.click(select);

            const viewerOption = screen.getByText("Viewer");
            fireEvent.click(viewerOption);

            expect(onRoleChange).toHaveBeenCalledWith("viewer");
        });

        it("shows CLI switch only for editor role", () => {
            const { rerender } = render(<RoleSelectionGroup {...defaultProps} role="editor" />);
            expect(screen.getByText("CLI Access")).toBeDefined();

            rerender(<RoleSelectionGroup {...defaultProps} role="viewer" />);
            expect(screen.queryByText("CLI Access")).toBeNull();

            rerender(<RoleSelectionGroup {...defaultProps} role="admin" />);
            expect(screen.queryByText("CLI Access")).toBeNull();
        });

        it("calls onCliEnabledChange when CLI switch is toggled", () => {
            const onCliEnabledChange = vi.fn();
            render(
                <RoleSelectionGroup
                    {...defaultProps}
                    role="editor"
                    cliEnabled={false}
                    onCliEnabledChange={onCliEnabledChange}
                />
            );

            const cliSwitch = screen.getByRole("switch");
            fireEvent.click(cliSwitch);

            expect(onCliEnabledChange).toHaveBeenCalledWith(true);
        });
    });

    describe("CLI access clearing on role change", () => {
        it("clears CLI access when changing from editor to viewer", () => {
            const onRoleChange = vi.fn();
            const onCliEnabledChange = vi.fn();

            render(
                <RoleSelectionGroup
                    {...defaultProps}
                    role="editor"
                    cliEnabled={true}
                    onRoleChange={onRoleChange}
                    onCliEnabledChange={onCliEnabledChange}
                />
            );

            const select = screen.getByRole("combobox");
            fireEvent.click(select);

            const viewerOption = screen.getByText("Viewer");
            fireEvent.click(viewerOption);

            expect(onRoleChange).toHaveBeenCalledWith("viewer");
            expect(onCliEnabledChange).toHaveBeenCalledWith(false);
        });

        it("clears CLI access when changing from editor to admin", () => {
            const onRoleChange = vi.fn();
            const onCliEnabledChange = vi.fn();

            render(
                <RoleSelectionGroup
                    {...defaultProps}
                    role="editor"
                    cliEnabled={true}
                    onRoleChange={onRoleChange}
                    onCliEnabledChange={onCliEnabledChange}
                />
            );

            const select = screen.getByRole("combobox");
            fireEvent.click(select);

            const adminOption = screen.getByText("Admin");
            fireEvent.click(adminOption);

            expect(onRoleChange).toHaveBeenCalledWith("admin");
            expect(onCliEnabledChange).toHaveBeenCalledWith(false);
        });

        it("does not call onCliEnabledChange when CLI is already disabled", () => {
            const onRoleChange = vi.fn();
            const onCliEnabledChange = vi.fn();

            render(
                <RoleSelectionGroup
                    {...defaultProps}
                    role="editor"
                    cliEnabled={false}
                    onRoleChange={onRoleChange}
                    onCliEnabledChange={onCliEnabledChange}
                />
            );

            const select = screen.getByRole("combobox");
            fireEvent.click(select);

            const viewerOption = screen.getByText("Viewer");
            fireEvent.click(viewerOption);

            expect(onRoleChange).toHaveBeenCalledWith("viewer");
            expect(onCliEnabledChange).not.toHaveBeenCalled();
        });

        it("does not clear CLI access when staying on editor role", () => {
            const onRoleChange = vi.fn();
            const onCliEnabledChange = vi.fn();

            render(
                <RoleSelectionGroup
                    {...defaultProps}
                    role="viewer"
                    cliEnabled={false}
                    onRoleChange={onRoleChange}
                    onCliEnabledChange={onCliEnabledChange}
                />
            );

            const select = screen.getByRole("combobox");
            fireEvent.click(select);

            const editorOption = screen.getByText("Editor");
            fireEvent.click(editorOption);

            expect(onRoleChange).toHaveBeenCalledWith("editor");
            expect(onCliEnabledChange).not.toHaveBeenCalled();
        });
    });

    describe("access type selection", () => {
        it("shows access type selector when showAccessTypeSelector is true", () => {
            const onAccessTypeChange = vi.fn();
            render(
                <RoleSelectionGroup
                    {...defaultProps}
                    showAccessTypeSelector={true}
                    accessType="org"
                    onAccessTypeChange={onAccessTypeChange}
                />
            );

            expect(screen.getByText("Access Type")).toBeDefined();
            expect(screen.getByText("Organization-level access")).toBeDefined();
            expect(screen.getByText("Fine-grained access")).toBeDefined();
        });

        it("hides role controls when fine-grained access is selected", () => {
            render(
                <RoleSelectionGroup
                    {...defaultProps}
                    showAccessTypeSelector={true}
                    accessType="fine-grained"
                    onAccessTypeChange={vi.fn()}
                    resources={[]}
                />
            );

            // Role selector should not be visible
            expect(screen.queryByRole("combobox")).toBeNull();
        });
    });

    describe("fine-grained resource permissions", () => {
        const resources = [
            { id: "resource-1", label: "docs.example.com" },
            { id: "resource-2", label: "api.example.com" }
        ];

        it("renders resources when in fine-grained mode", () => {
            render(
                <RoleSelectionGroup
                    {...defaultProps}
                    showAccessTypeSelector={true}
                    accessType="fine-grained"
                    onAccessTypeChange={vi.fn()}
                    resources={resources}
                    resourceRoles={{ "resource-1": "editor", "resource-2": "viewer" }}
                    onResourceRoleChange={vi.fn()}
                />
            );

            expect(screen.getByText("docs.example.com")).toBeDefined();
            expect(screen.getByText("api.example.com")).toBeDefined();
        });

        it("shows CLI toggle only for resources with editor role", () => {
            render(
                <RoleSelectionGroup
                    {...defaultProps}
                    showAccessTypeSelector={true}
                    accessType="fine-grained"
                    onAccessTypeChange={vi.fn()}
                    resources={resources}
                    resourceRoles={{ "resource-1": "editor", "resource-2": "viewer" }}
                    resourceCliAccess={{ "resource-1": false, "resource-2": false }}
                    onResourceRoleChange={vi.fn()}
                    onResourceCliAccessChange={vi.fn()}
                />
            );

            // Only one CLI Access label should be visible (for the editor resource)
            const cliAccessLabels = screen.getAllByText("CLI Access");
            expect(cliAccessLabels.length).toBe(1);
        });

        it("clears resource CLI access when changing resource role from editor to viewer", () => {
            const onResourceRoleChange = vi.fn();
            const onResourceCliAccessChange = vi.fn();

            render(
                <RoleSelectionGroup
                    {...defaultProps}
                    showAccessTypeSelector={true}
                    accessType="fine-grained"
                    onAccessTypeChange={vi.fn()}
                    resources={[{ id: "resource-1", label: "docs.example.com" }]}
                    resourceRoles={{ "resource-1": "editor" }}
                    resourceCliAccess={{ "resource-1": true }}
                    onResourceRoleChange={onResourceRoleChange}
                    onResourceCliAccessChange={onResourceCliAccessChange}
                />
            );

            // Click the resource's role select
            const select = screen.getByRole("combobox");
            fireEvent.click(select);

            const viewerOption = screen.getByText("Viewer");
            fireEvent.click(viewerOption);

            expect(onResourceRoleChange).toHaveBeenCalledWith("resource-1", "viewer");
            expect(onResourceCliAccessChange).toHaveBeenCalledWith("resource-1", false);
        });

        it("clears resource CLI access when changing resource role from editor to admin", () => {
            const onResourceRoleChange = vi.fn();
            const onResourceCliAccessChange = vi.fn();

            render(
                <RoleSelectionGroup
                    {...defaultProps}
                    showAccessTypeSelector={true}
                    accessType="fine-grained"
                    onAccessTypeChange={vi.fn()}
                    resources={[{ id: "resource-1", label: "docs.example.com" }]}
                    resourceRoles={{ "resource-1": "editor" }}
                    resourceCliAccess={{ "resource-1": true }}
                    onResourceRoleChange={onResourceRoleChange}
                    onResourceCliAccessChange={onResourceCliAccessChange}
                />
            );

            const select = screen.getByRole("combobox");
            fireEvent.click(select);

            const adminOption = screen.getByText("Admin");
            fireEvent.click(adminOption);

            expect(onResourceRoleChange).toHaveBeenCalledWith("resource-1", "admin");
            expect(onResourceCliAccessChange).toHaveBeenCalledWith("resource-1", false);
        });

        it("clears resource CLI access when changing resource role to no access", () => {
            const onResourceRoleChange = vi.fn();
            const onResourceCliAccessChange = vi.fn();

            render(
                <RoleSelectionGroup
                    {...defaultProps}
                    showAccessTypeSelector={true}
                    accessType="fine-grained"
                    onAccessTypeChange={vi.fn()}
                    resources={[{ id: "resource-1", label: "docs.example.com" }]}
                    resourceRoles={{ "resource-1": "editor" }}
                    resourceCliAccess={{ "resource-1": true }}
                    onResourceRoleChange={onResourceRoleChange}
                    onResourceCliAccessChange={onResourceCliAccessChange}
                />
            );

            const select = screen.getByRole("combobox");
            fireEvent.click(select);

            const noAccessOption = screen.getByText("No access");
            fireEvent.click(noAccessOption);

            expect(onResourceRoleChange).toHaveBeenCalledWith("resource-1", "none");
            expect(onResourceCliAccessChange).toHaveBeenCalledWith("resource-1", false);
        });

        it("does not clear resource CLI access when CLI is already disabled", () => {
            const onResourceRoleChange = vi.fn();
            const onResourceCliAccessChange = vi.fn();

            render(
                <RoleSelectionGroup
                    {...defaultProps}
                    showAccessTypeSelector={true}
                    accessType="fine-grained"
                    onAccessTypeChange={vi.fn()}
                    resources={[{ id: "resource-1", label: "docs.example.com" }]}
                    resourceRoles={{ "resource-1": "editor" }}
                    resourceCliAccess={{ "resource-1": false }}
                    onResourceRoleChange={onResourceRoleChange}
                    onResourceCliAccessChange={onResourceCliAccessChange}
                />
            );

            const select = screen.getByRole("combobox");
            fireEvent.click(select);

            const viewerOption = screen.getByText("Viewer");
            fireEvent.click(viewerOption);

            expect(onResourceRoleChange).toHaveBeenCalledWith("resource-1", "viewer");
            expect(onResourceCliAccessChange).not.toHaveBeenCalled();
        });

        it("shows loading state when resources are loading", () => {
            render(
                <RoleSelectionGroup
                    {...defaultProps}
                    showAccessTypeSelector={true}
                    accessType="fine-grained"
                    onAccessTypeChange={vi.fn()}
                    isLoadingResources={true}
                />
            );

            expect(screen.getByText("Loading resources...")).toBeDefined();
        });

        it("shows empty state when no resources exist", () => {
            render(
                <RoleSelectionGroup
                    {...defaultProps}
                    showAccessTypeSelector={true}
                    accessType="fine-grained"
                    onAccessTypeChange={vi.fn()}
                    resources={[]}
                />
            );

            expect(screen.getByText("No resources found for this organization.")).toBeDefined();
        });
    });

    describe("disabled state", () => {
        it("disables role selector when disabled is true", () => {
            render(<RoleSelectionGroup {...defaultProps} disabled={true} />);

            const select = screen.getByRole("combobox");
            // Select component uses data-disabled attribute when disabled
            expect(select.hasAttribute("data-disabled")).toBe(true);
        });

        it("disables CLI switch when disabled is true", () => {
            render(<RoleSelectionGroup {...defaultProps} role="editor" disabled={true} />);

            const cliSwitch = screen.getByRole("switch");
            expect(cliSwitch.hasAttribute("data-disabled")).toBe(true);
        });
    });
});
