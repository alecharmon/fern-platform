"use client";

import type { ResourceRole, Roles, UserRolePerResource } from "@fern-api/user-permissions";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { ReactQueryKey } from "@/state/queryKeys";
import { useOrgMembers } from "@/state/useOrgMembers";

import { Button } from "../ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import {
    type AccessType,
    RoleSelectionGroup,
    type ResourceRole as RoleSelectionResourceRole,
    type UserRole
} from "./RoleSelection";

export declare namespace EditPermissionsDialog {
    export interface Props {
        open: boolean;
        onOpenChange: (open: boolean) => void;
        orgName: Auth0OrgName;
        userId: Auth0UserID;
        userName: string;
        currentRoles: Roles[];
        isFineGrainedPermissionsEnabled?: boolean;
    }
}

export function EditPermissionsDialog({
    open,
    onOpenChange,
    orgName,
    userId,
    userName,
    currentRoles,
    isFineGrainedPermissionsEnabled = false
}: EditPermissionsDialog.Props) {
    const { refetch } = useOrgMembers();

    // Extract the primary role (admin/editor/viewer) from current roles
    const currentPrimaryRole: UserRole =
        (currentRoles.find((r): r is UserRole => ["admin", "editor", "viewer"].includes(r)) as UserRole) ?? "viewer";
    const currentCliEnabled = currentRoles.includes("cli");

    const [selectedRole, setSelectedRole] = useState<UserRole>(currentPrimaryRole);
    const [cliEnabled, setCliEnabled] = useState(currentCliEnabled);
    const [accessType, setAccessType] = useState<AccessType>("org");
    const [resourceRoles, setResourceRoles] = useState<Record<string, ResourceRole | "none">>({});
    const [initialResourceRoles, setInitialResourceRoles] = useState<Record<string, ResourceRole | "none">>({});
    const [resourceCliAccess, setResourceCliAccess] = useState<Record<string, boolean>>({});
    const [initialResourceCliAccess, setInitialResourceCliAccess] = useState<Record<string, boolean>>({});

    const queryClient = useQueryClient();

    // Fetch docs sites when fine-grained permissions is enabled
    const docsSitesQuery = useQuery({
        queryKey: ["docs-sites", orgName],
        queryFn: async () => {
            const response = await DashboardApiClient.getDocsSites({ orgName });
            if (!response.ok) {
                throw new Error(response.error ?? "Failed to fetch docs sites");
            }
            return response.docsSites ?? [];
        },
        enabled: isFineGrainedPermissionsEnabled && open
    });

    // Fetch user's current resource roles
    const userResourceRolesQuery = useQuery({
        queryKey: ["user-resource-roles", orgName, userId],
        queryFn: async () => {
            const response = await DashboardApiClient.getUserResourceRoles({
                orgName,
                userId
            });
            if (!response.ok) {
                throw new Error(response.error ?? "Failed to fetch user resource roles");
            }
            return response.resourceRoles ?? [];
        },
        enabled: isFineGrainedPermissionsEnabled && open
    });

    // Initialize resource roles state when data is loaded
    useEffect(() => {
        if (userResourceRolesQuery.data && docsSitesQuery.data) {
            const roles: Record<string, ResourceRole | "none"> = {};
            const cliAccess: Record<string, boolean> = {};
            const hasAnyResourceRoles = userResourceRolesQuery.data.length > 0;

            for (const site of docsSitesQuery.data) {
                // Find the primary role (non-cli) for this resource
                const userRole = userResourceRolesQuery.data.find(
                    (r: UserRolePerResource) =>
                        r.resource_type === "docs" && r.resource_id === site.url && r.role !== "cli"
                );
                roles[site.url] = userRole?.role ?? "none";

                // Check if user has CLI access for this resource
                const hasCliRole = userResourceRolesQuery.data.some(
                    (r: UserRolePerResource) =>
                        r.resource_type === "docs" && r.resource_id === site.url && r.role === "cli"
                );
                cliAccess[site.url] = hasCliRole;
            }

            setResourceRoles(roles);
            setInitialResourceRoles(roles);
            setResourceCliAccess(cliAccess);
            setInitialResourceCliAccess(cliAccess);

            // Set access type based on whether user has resource-level roles
            if (hasAnyResourceRoles) {
                setAccessType("fine-grained");
            }
        }
    }, [userResourceRolesQuery.data, docsSitesQuery.data]);

    const updatePermissions = useMutation({
        mutationFn: async () => {
            if (isFineGrainedPermissionsEnabled && accessType === "fine-grained") {
                // Build resource roles payload, filtering out "none" entries
                const resourceRolesPayload: Record<
                    string,
                    { role: "admin" | "editor" | "viewer"; cliEnabled: boolean }
                > = {};

                for (const [resourceId, role] of Object.entries(resourceRoles)) {
                    if (role && role !== "none") {
                        resourceRolesPayload[resourceId] = {
                            role: role as "admin" | "editor" | "viewer",
                            cliEnabled: resourceCliAccess[resourceId] ?? false
                        };
                    }
                }

                return DashboardApiClient.updateUserPermissions({
                    orgName,
                    userId,
                    permissions: {
                        type: "fine-grained",
                        resourceRoles: resourceRolesPayload
                    }
                });
            } else {
                return DashboardApiClient.updateUserPermissions({
                    orgName,
                    userId,
                    permissions: {
                        type: "org",
                        role: selectedRole,
                        cliEnabled
                    }
                });
            }
        },
        onSuccess: async (result) => {
            if (!result.ok) {
                toast.error(result.message ?? "Failed to update permissions.");
                return;
            }
            toast.success(`Permissions updated for ${userName}`);
            // Invalidate and refetch fresh data
            await refetch();
            await queryClient.refetchQueries({
                queryKey: ReactQueryKey.orgMembers(orgName)
            });
            await queryClient.refetchQueries({
                queryKey: ["user-resource-roles", orgName, userId]
            });
            onOpenChange(false);
        },
        onError: (error) => {
            console.error("Failed to update permissions:", error);
            toast.error("Failed to update permissions. Please try again.");
        }
    });

    const hasOrgChanges = selectedRole !== currentPrimaryRole || cliEnabled !== currentCliEnabled;
    const hasResourceChanges =
        isFineGrainedPermissionsEnabled && JSON.stringify(resourceRoles) !== JSON.stringify(initialResourceRoles);
    const hasResourceCliChanges =
        isFineGrainedPermissionsEnabled &&
        JSON.stringify(resourceCliAccess) !== JSON.stringify(initialResourceCliAccess);
    const hasAccessTypeChange =
        isFineGrainedPermissionsEnabled &&
        accessType === "org" &&
        (Object.values(initialResourceRoles).some((r) => r !== "none") ||
            Object.values(initialResourceCliAccess).some((c) => c));
    const hasChanges = hasOrgChanges || hasResourceChanges || hasResourceCliChanges || hasAccessTypeChange;
    const isUpdating = updatePermissions.isPending;

    const handleSave = () => {
        if (!hasChanges) {
            toast.warning("The user already has this role access.");
            return;
        }
        updatePermissions.mutate();
    };

    // Reset state when dialog opens or closes without saving
    const handleOpenChange = (newOpen: boolean) => {
        if (newOpen) {
            setSelectedRole(currentPrimaryRole);
            setCliEnabled(currentCliEnabled);
            // Access type and resource roles will be set by the useEffect when data loads
        } else {
            // Reset all state when closing without saving
            setSelectedRole(currentPrimaryRole);
            setCliEnabled(currentCliEnabled);
            setAccessType(
                Object.values(initialResourceRoles).some((r) => r !== "none") ||
                    Object.values(initialResourceCliAccess).some((c) => c)
                    ? "fine-grained"
                    : "org"
            );
            setResourceRoles(initialResourceRoles);
            setResourceCliAccess(initialResourceCliAccess);
        }
        onOpenChange(newOpen);
    };

    const isLoadingResources =
        isFineGrainedPermissionsEnabled && (docsSitesQuery.isLoading || userResourceRolesQuery.isLoading);

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Change {userName}'s Role</DialogTitle>
                </DialogHeader>
                <DialogBody>
                    <div className="space-y-6">
                        <RoleSelectionGroup
                            roleLabel="Member Role"
                            role={selectedRole}
                            onRoleChange={setSelectedRole}
                            cliEnabled={cliEnabled}
                            onCliEnabledChange={setCliEnabled}
                            disabled={isUpdating}
                            id="edit-permissions"
                            showAccessTypeSelector={isFineGrainedPermissionsEnabled}
                            accessType={accessType}
                            onAccessTypeChange={setAccessType}
                            resources={docsSitesQuery.data?.map((site) => ({
                                id: site.url,
                                label: site.url
                            }))}
                            resourceRoles={resourceRoles as Record<string, RoleSelectionResourceRole | "none">}
                            onResourceRoleChange={(resourceId, role) =>
                                setResourceRoles((prev) => ({
                                    ...prev,
                                    [resourceId]: role as ResourceRole | "none"
                                }))
                            }
                            resourceCliAccess={resourceCliAccess}
                            onResourceCliAccessChange={(resourceId, enabled) =>
                                setResourceCliAccess((prev) => ({
                                    ...prev,
                                    [resourceId]: enabled
                                }))
                            }
                            isLoadingResources={isLoadingResources}
                            resourcesLabel="Docs Sites"
                        />
                    </div>
                </DialogBody>
                <DialogFooter>
                    <div className="flex w-full items-center justify-between">
                        <a
                            href="https://buildwithfern.com/learn/dashboard/configuration/permissions"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-green-1100 hover:text-green-700  dark:text-green"
                        >
                            Learn more
                            <svg
                                className="size-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                />
                            </svg>
                        </a>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUpdating}>
                                Cancel
                            </Button>
                            <Button onClick={handleSave} disabled={isUpdating}>
                                {isUpdating ? (
                                    <>
                                        Saving...
                                        <Loader2 className="size-4 animate-spin" />
                                    </>
                                ) : (
                                    "Save changes"
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
