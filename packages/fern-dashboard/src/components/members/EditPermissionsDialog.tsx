"use client";

import type { ResourceRole, Roles, UserRolePerResource } from "@fern-api/user-permissions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { removeUserResourceRole } from "@/app/actions/removeUserResourceRole";
import { setUserResourceRole } from "@/app/actions/setUserResourceRole";
import type { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { ReactQueryKey } from "@/state/queryKeys";
import { useOrgMembers } from "@/state/useOrgMembers";
import { Button } from "../ui/button";
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "../ui/dialog";
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
            const response = await DashboardApiClient.getUserResourceRoles({ orgName, userId });
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

    const updateRoles = useMutation({
        mutationFn: async () => {
            // Determine the org role based on access type
            // When fine-grained is selected, set minimal org role (viewer) so access is controlled by resource roles
            const orgRole: UserRole =
                isFineGrainedPermissionsEnabled && accessType === "fine-grained" ? "viewer" : selectedRole;

            const newRoles: Roles[] = [orgRole];
            // Only add global CLI access when using org-level access AND role is editor
            if (cliEnabled && (!isFineGrainedPermissionsEnabled || accessType === "org") && orgRole === "editor") {
                newRoles.push("cli");
            }

            // Update Auth0 roles (filter out fine_grain as it's managed separately)
            const filteredCurrentRoles = currentRoles.filter(
                (r): r is Exclude<Roles, "fine_grain"> => r !== "fine_grain"
            );
            const filteredNewRoles = newRoles.filter((r): r is Exclude<Roles, "fine_grain"> => r !== "fine_grain");
            const auth0Result = await DashboardApiClient.updateUserRoles({
                orgName,
                userId,
                currentRoles: filteredCurrentRoles,
                newRoles: filteredNewRoles
            });

            if (!auth0Result.ok) {
                throw new Error(auth0Result.message ?? "Failed to update Auth0 roles");
            }

            // Update resource roles if fine-grained permissions is enabled
            if (isFineGrainedPermissionsEnabled) {
                const docsSites = docsSitesQuery.data ?? [];

                if (accessType === "org") {
                    // Remove all resource roles when switching to org-level access
                    for (const site of docsSites) {
                        const currentRole = initialResourceRoles[site.url];
                        if (currentRole && currentRole !== "none") {
                            await removeUserResourceRole({
                                orgName,
                                userId,
                                resourceType: "docs",
                                resourceId: site.url,
                                role: currentRole
                            });
                        }
                        // Also remove CLI role for this resource
                        if (initialResourceCliAccess[site.url]) {
                            await removeUserResourceRole({
                                orgName,
                                userId,
                                resourceType: "docs",
                                resourceId: site.url,
                                role: "cli" as ResourceRole
                            });
                        }
                    }
                } else {
                    // Fine-grained access: update resource roles and CLI access
                    for (const site of docsSites) {
                        const newRole = resourceRoles[site.url];
                        const previousRole = initialResourceRoles[site.url];

                        // Handle primary role changes
                        if (newRole !== previousRole) {
                            if (newRole === "none" && previousRole && previousRole !== "none") {
                                // Remove the role
                                await removeUserResourceRole({
                                    orgName,
                                    userId,
                                    resourceType: "docs",
                                    resourceId: site.url,
                                    role: previousRole
                                });
                            } else if (newRole && newRole !== "none") {
                                // Set or update the role
                                await setUserResourceRole({
                                    orgName,
                                    userId,
                                    resourceType: "docs",
                                    resourceId: site.url,
                                    role: newRole,
                                    previousRole: previousRole !== "none" ? previousRole : undefined
                                });
                            }
                        }

                        // Handle CLI access changes per resource (only valid when role is editor)
                        const newCliAccess = resourceCliAccess[site.url] ?? false;
                        const previousCliAccess = initialResourceCliAccess[site.url] ?? false;
                        const isEditor = newRole === "editor";
                        const wasEditor = previousRole === "editor";

                        // If role changed away from editor, always remove CLI
                        if (wasEditor && !isEditor && previousCliAccess) {
                            await removeUserResourceRole({
                                orgName,
                                userId,
                                resourceType: "docs",
                                resourceId: site.url,
                                role: "cli" as ResourceRole
                            });
                        } else if (isEditor && newCliAccess !== previousCliAccess) {
                            // Only update CLI if role is editor
                            if (newCliAccess) {
                                // Add CLI access
                                await setUserResourceRole({
                                    orgName,
                                    userId,
                                    resourceType: "docs",
                                    resourceId: site.url,
                                    role: "cli" as ResourceRole
                                });
                            } else {
                                // Remove CLI access
                                await removeUserResourceRole({
                                    orgName,
                                    userId,
                                    resourceType: "docs",
                                    resourceId: site.url,
                                    role: "cli" as ResourceRole
                                });
                            }
                        }
                    }
                }
            }

            return auth0Result;
        },
        onSuccess: async () => {
            toast.success(`Permissions updated for ${userName}`);
            // Invalidate and refetch fresh data
            await refetch();
            await queryClient.refetchQueries({ queryKey: ReactQueryKey.orgMembers(orgName) });
            await queryClient.invalidateQueries({ queryKey: ["user-resource-roles", orgName, userId] });
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
    const isUpdating = updateRoles.isPending;

    const handleSave = () => {
        if (!hasChanges) {
            onOpenChange(false);
            return;
        }
        updateRoles.mutate();
    };

    // Reset state when dialog opens
    const handleOpenChange = (newOpen: boolean) => {
        if (newOpen) {
            setSelectedRole(currentPrimaryRole);
            setCliEnabled(currentCliEnabled);
            // Access type and resource roles will be set by the useEffect when data loads
        }
        onOpenChange(newOpen);
    };

    const isLoadingResources =
        isFineGrainedPermissionsEnabled && (docsSitesQuery.isLoading || userResourceRolesQuery.isLoading);

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Edit permissions for {userName}</DialogTitle>
                    <DialogDescription>Update the role and access permissions for this member.</DialogDescription>
                </DialogHeader>
                <DialogBody>
                    <div className="space-y-6">
                        <RoleSelectionGroup
                            roleLabel="Organization Role"
                            role={selectedRole}
                            onRoleChange={setSelectedRole}
                            cliEnabled={cliEnabled}
                            onCliEnabledChange={setCliEnabled}
                            disabled={isUpdating}
                            id="edit-permissions"
                            showAccessTypeSelector={isFineGrainedPermissionsEnabled}
                            accessType={accessType}
                            onAccessTypeChange={setAccessType}
                            resources={docsSitesQuery.data?.map((site) => ({ id: site.url, label: site.url }))}
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
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUpdating}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isUpdating || !hasChanges}>
                        {isUpdating ? (
                            <>
                                Saving...
                                <Loader2 className="size-4 animate-spin" />
                            </>
                        ) : (
                            "Save changes"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
