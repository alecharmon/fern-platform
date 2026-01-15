"use client";

import type { Roles } from "@fern-api/user-permissions";
import PencilIcon from "@heroicons/react/24/outline/PencilIcon";
import UserMinusIcon from "@heroicons/react/24/outline/UserMinusIcon";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GetMembers200ResponseOneOfInner } from "auth0";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { removeUserFromOrg } from "@/app/actions/removeUserFromOrg";
import { Auth0UserID } from "@/app/services/auth0/types";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { type inferQueryData, ReactQueryKey } from "@/state/queryKeys";
import { useOrganizations } from "@/state/useOrganizations";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";
import { DropdownMenuItem, DropdownMenuSeparator } from "../ui/dropdown-menu";
import { EditPermissionsDialog } from "./EditPermissionsDialog";
import { MemberOrInviteeRow } from "./MemberOrInviteeRow";

export declare namespace MemberRow {
    export interface Props {
        member: GetMembers200ResponseOneOfInner;
        currentUserId: Auth0UserID;
        isFineGrainedPermissionsEnabled?: boolean;
    }
}

const VALID_ROLES: Roles[] = ["admin", "editor", "viewer", "cli", "fine_grain"];

export function MemberRow({ member, currentUserId, isFineGrainedPermissionsEnabled = false }: MemberRow.Props) {
    const orgName = useOrgNameFromPathname();
    const queryKey = ReactQueryKey.orgMembers(orgName);
    const router = useRouter();
    const organizations = useOrganizations();
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    const queryClient = useQueryClient();
    const isCurrentUser = currentUserId === member.user_id;

    // Fetch user's resource roles to check for fine-grained access
    const userResourceRolesQuery = useQuery({
        queryKey: ["user-resource-roles", orgName, member.user_id],
        queryFn: async () => {
            const response = await DashboardApiClient.getUserResourceRoles({
                orgName,
                userId: Auth0UserID(member.user_id)
            });
            if (!response.ok) {
                return [];
            }
            return response.resourceRoles ?? [];
        },
        enabled: isFineGrainedPermissionsEnabled
    });

    const hasFineGrainedAccess =
        isFineGrainedPermissionsEnabled && userResourceRolesQuery.data && userResourceRolesQuery.data.length > 0;

    const memberRoles = member.roles
        .map((role) => role.name)
        .filter((role): role is Roles => VALID_ROLES.includes(role as Roles));

    // When user has fine-grained access, only show the fine_grain badge (not org-level roles)
    // When user has org-level access, show org-level roles (admin/editor/viewer + cli if applicable)
    const displayRoles: Roles[] = hasFineGrainedAccess ? ["fine_grain"] : memberRoles.filter((r) => r !== "fine_grain");

    const removeMember = useMutation({
        mutationFn: () =>
            removeUserFromOrg({
                orgName,
                userIdToRemove: Auth0UserID(member.user_id)
            }),
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey });

            const previousMembers = queryClient.getQueryData<inferQueryData<typeof queryKey>>(queryKey);

            queryClient.setQueryData<inferQueryData<typeof queryKey>>(queryKey, (previousMembers) =>
                previousMembers != null ? previousMembers.filter((m) => m.user_id !== member.user_id) : previousMembers
            );

            return { previousMembers };
        },
        onSuccess: async () => {
            // If user is removing themselves, redirect to another org
            if (isCurrentUser) {
                // Invalidate organizations cache to update the list
                await queryClient.invalidateQueries({ queryKey: ReactQueryKey.myOrganizations() });

                // Find another organization to redirect to
                const remainingOrgs =
                    organizations.type === "loaded" ? organizations.value.filter((org) => org.name !== orgName) : [];

                // Redirect to another org if available, otherwise go to home
                if (remainingOrgs?.[0]) {
                    router.push(`/${remainingOrgs[0].name}/docs`);
                } else {
                    router.push("/");
                }
            }
        },
        onError: async (error, _variables, context) => {
            console.error(`Failed to remove ${member.name} (${member.email}, ${member.email})`, error);
            toast.error(`Failed to remove ${member.name}`);
            if (context?.previousMembers != null) {
                queryClient.setQueryData<inferQueryData<typeof queryKey>>(queryKey, context.previousMembers);
            }

            // only invalidate on error. if we invalidate on success, we can wipe
            // out other optimsitic writes (if the user is removing multiple members)
            await queryClient.invalidateQueries({ queryKey });
        }
    });

    return (
        <>
            <MemberOrInviteeRow
                title={member.name}
                subtitle={member.email}
                roles={displayRoles}
                pictureUrl={member.picture}
                dropdownMenuItems={
                    <>
                        {!isCurrentUser && (
                            <>
                                <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                                    <PencilIcon /> Edit permissions
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                            </>
                        )}
                        <DropdownMenuItem
                            variant="destructive"
                            onClick={() => {
                                removeMember.mutate();
                            }}
                        >
                            <UserMinusIcon /> {isCurrentUser ? "Leave organization" : "Remove member"}
                        </DropdownMenuItem>
                    </>
                }
            />
            {!isCurrentUser && (
                <EditPermissionsDialog
                    open={isEditDialogOpen}
                    onOpenChange={setIsEditDialogOpen}
                    orgName={orgName}
                    userId={Auth0UserID(member.user_id)}
                    userName={member.name}
                    currentRoles={memberRoles}
                    isFineGrainedPermissionsEnabled={isFineGrainedPermissionsEnabled}
                />
            )}
        </>
    );
}
