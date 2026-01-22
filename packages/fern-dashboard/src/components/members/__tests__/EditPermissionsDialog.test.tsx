/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import type { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";

// Mock DashboardApiClient
vi.mock("@/app/services/dashboard-api/client", () => ({
    DashboardApiClient: {
        getDocsSites: vi.fn(),
        getUserResourceRoles: vi.fn(),
        updateUserPermissions: vi.fn()
    }
}));

// Mock useOrgMembers
vi.mock("@/state/useOrgMembers", () => ({
    useOrgMembers: () => ({ refetch: vi.fn() })
}));

// Mock sonner toast
vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn()
    }
}));

import { toast } from "sonner";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";

import { EditPermissionsDialog } from "../EditPermissionsDialog";

const mockGetDocsSites = DashboardApiClient.getDocsSites as Mock;
const mockGetUserResourceRoles = DashboardApiClient.getUserResourceRoles as Mock;
const mockUpdateUserPermissions = DashboardApiClient.updateUserPermissions as Mock;

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    });
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
}

describe("EditPermissionsDialog", () => {
    const defaultProps = {
        open: true,
        onOpenChange: vi.fn(),
        orgName: "test-org" as Auth0OrgName,
        userId: "auth0|user123" as Auth0UserID,
        userName: "Test User",
        currentRoles: ["viewer" as const],
        isFineGrainedPermissionsEnabled: false
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetDocsSites.mockResolvedValue({ ok: true, docsSites: [] });
        mockGetUserResourceRoles.mockResolvedValue({ ok: true, resourceRoles: [] });
        mockUpdateUserPermissions.mockResolvedValue({ ok: true });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("rendering", () => {
        it("renders dialog with user name", () => {
            render(<EditPermissionsDialog {...defaultProps} />, { wrapper: createWrapper() });

            expect(screen.getByText("Change Test User's Role")).toBeDefined();
        });

        it("renders save and cancel buttons", () => {
            render(<EditPermissionsDialog {...defaultProps} />, { wrapper: createWrapper() });

            expect(screen.getByRole("button", { name: /save changes/i })).toBeDefined();
            expect(screen.getByRole("button", { name: /cancel/i })).toBeDefined();
        });

        it("renders learn more link", () => {
            render(<EditPermissionsDialog {...defaultProps} />, { wrapper: createWrapper() });

            const link = screen.getByRole("link", { name: /learn more/i });
            expect(link).toBeDefined();
            expect(link.getAttribute("href")).toBe(
                "https://buildwithfern.com/learn/dashboard/configuration/permissions"
            );
        });
    });

    describe("no changes handling", () => {
        it("shows warning when no changes are made", async () => {
            render(<EditPermissionsDialog {...defaultProps} />, { wrapper: createWrapper() });

            // Click save without making changes
            const saveButton = screen.getByRole("button", { name: /save changes/i });
            fireEvent.click(saveButton);

            await waitFor(() => {
                expect(toast.warning).toHaveBeenCalledWith("The user already has this role access.");
            });

            expect(mockUpdateUserPermissions).not.toHaveBeenCalled();
        });
    });

    describe("dialog close", () => {
        it("calls onOpenChange when cancel is clicked", async () => {
            const onOpenChange = vi.fn();

            render(<EditPermissionsDialog {...defaultProps} onOpenChange={onOpenChange} />, {
                wrapper: createWrapper()
            });

            const cancelButton = screen.getByRole("button", { name: /cancel/i });
            fireEvent.click(cancelButton);

            expect(onOpenChange).toHaveBeenCalledWith(false);
        });
    });

    describe("fine-grained permissions", () => {
        const fineGrainedProps = {
            ...defaultProps,
            isFineGrainedPermissionsEnabled: true
        };

        beforeEach(() => {
            mockGetDocsSites.mockResolvedValue({
                ok: true,
                docsSites: [{ url: "docs.example.com" }, { url: "api.example.com" }]
            });
            mockGetUserResourceRoles.mockResolvedValue({
                ok: true,
                resourceRoles: []
            });
        });

        it("fetches docs sites when fine-grained is enabled", async () => {
            render(<EditPermissionsDialog {...fineGrainedProps} />, { wrapper: createWrapper() });

            await waitFor(() => {
                expect(mockGetDocsSites).toHaveBeenCalledWith({ orgName: "test-org" });
            });
        });

        it("fetches user resource roles when fine-grained is enabled", async () => {
            render(<EditPermissionsDialog {...fineGrainedProps} />, { wrapper: createWrapper() });

            await waitFor(() => {
                expect(mockGetUserResourceRoles).toHaveBeenCalledWith({
                    orgName: "test-org",
                    userId: "auth0|user123"
                });
            });
        });
    });
});
