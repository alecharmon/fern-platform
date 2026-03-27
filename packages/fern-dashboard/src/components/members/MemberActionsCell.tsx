"use client";

import type { Roles } from "@fern-api/user-permissions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Pencil, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { removeUserFromOrg } from "@/app/actions/removeUserFromOrg";
import { rescindInvitation } from "@/app/actions/rescindInvitation";
import { Auth0UserID, type OrgMemberWithMetadata } from "@/app/services/auth0/types";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { type inferQueryData, ReactQueryKey } from "@/state/queryKeys";
import type { OrgInvitation } from "@/state/types";
import { useOrganizations } from "@/state/useOrganizations";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";

import { Button } from "../ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "../ui/dropdown-menu";
import { EditPermissionsDialog } from "./EditPermissionsDialog";
import type { MemberTableRow } from "./member-table-utils";

const VALID_ROLES: Roles[] = ["admin", "editor", "viewer", "cli", "fine_grain"];

export interface MemberActionsCellProps {
    row: MemberTableRow;
    currentUserId: Auth0UserID;
    isFineGrainedPermissionsEnabled: boolean;
}

export function MemberActionsCell({ row, currentUserId, isFineGrainedPermissionsEnabled }: MemberActionsCellProps) {
    if (row.kind === "member") {
        return (
            <MemberActions
                row={row}
                currentUserId={currentUserId}
                isFineGrainedPermissionsEnabled={isFineGrainedPermissionsEnabled}
            />
        );
    }
    return <InviteeActions row={row} />;
}

function MemberActions({ row, currentUserId, isFineGrainedPermissionsEnabled }: MemberActionsCellProps) {
    const orgName = useOrgNameFromPathname();
    const queryKey = ReactQueryKey.orgMembers(orgName);
    const router = useRouter();
    const organizations = useOrganizations();
    const queryClient = useQueryClient();
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    const member = row.raw as OrgMemberWithMetadata;
    const isCurrentUser = currentUserId === member.user_id;

    const memberRoles = member.roles
        .map((role) => role.name)
        .filter((role): role is Roles => VALID_ROLES.includes(role as Roles));

    // Pre-fetch user's resource roles so EditPermissionsDialog has cached data
    useQuery({
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
            if (isCurrentUser) {
                await queryClient.invalidateQueries({ queryKey: ReactQueryKey.myOrganizations() });

                const remainingOrgs =
                    organizations.type === "loaded" ? organizations.value.filter((org) => org.name !== orgName) : [];

                if (remainingOrgs?.[0]) {
                    router.push(`/${remainingOrgs[0].name}/docs`);
                } else {
                    router.push("/");
                }
            }
            // Refetch to ensure UI is in sync after optimistic update
            await queryClient.invalidateQueries({ queryKey });
        },
        onError: async (error, _variables, context) => {
            console.error(`Failed to remove ${member.name} (${member.email}, ${member.email})`, error);
            toast.error(`Failed to remove ${member.name}`);
            if (context?.previousMembers != null) {
                queryClient.setQueryData<inferQueryData<typeof queryKey>>(queryKey, context.previousMembers);
            }

            await queryClient.invalidateQueries({ queryKey });
        }
    });

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost">
                        <MoreHorizontal className="size-5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {!isCurrentUser && (
                        <>
                            <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                                <Pencil /> Change role
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
                        <UserMinus /> {isCurrentUser ? "Leave organization" : "Remove member"}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
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

function InviteeActions({ row }: { row: MemberTableRow }) {
    const orgName = useOrgNameFromPathname();
    const queryKey = ReactQueryKey.orgInvitations(orgName);
    const queryClient = useQueryClient();

    const invitation = row.raw as OrgInvitation;

    const rescind = useMutation({
        mutationFn: async () => {
            if (invitation.id != null) {
                await rescindInvitation({
                    orgName,
                    invitationId: invitation.id
                });
                return;
            }
        },
        onMutate: async () => {
            if (invitation.id == null) {
                return;
            }

            await queryClient.cancelQueries({ queryKey });

            const previousInvitations = queryClient.getQueryData<inferQueryData<typeof queryKey>>(queryKey);

            queryClient.setQueryData<inferQueryData<typeof queryKey>>(queryKey, (oldInvitations = []) =>
                oldInvitations.filter((oldInvitation) => oldInvitation.id !== invitation.id)
            );

            return { previousInvitations };
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey });
        },
        onError: async (error, _variables, context) => {
            console.error(`Failed to rescind invitation to ${invitation.inviteeEmail}`, error);
            toast.error(`Failed to rescind invitation to ${invitation.inviteeEmail}`);
            if (context?.previousInvitations != null) {
                queryClient.setQueryData<inferQueryData<typeof queryKey>>(queryKey, context.previousInvitations);
            }

            await queryClient.invalidateQueries({ queryKey });
        }
    });

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost">
                    <MoreHorizontal className="size-5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                        rescind.mutate();
                    }}
                    disabled={invitation.id == null}
                >
                    <UserMinus /> Rescind invitation
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
