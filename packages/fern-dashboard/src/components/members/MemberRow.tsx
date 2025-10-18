"use client";

import UserMinusIcon from "@heroicons/react/24/outline/UserMinusIcon";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { GetMembers200ResponseOneOfInner } from "auth0";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { removeUserFromOrg } from "@/app/actions/removeUserFromOrg";
import { Auth0UserID } from "@/app/services/auth0/types";
import { type inferQueryData, ReactQueryKey } from "@/state/queryKeys";
import { useOrganizations } from "@/state/useOrganizations";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";

import { DropdownMenuItem } from "../ui/dropdown-menu";
import { MemberOrInviteeRow } from "./MemberOrInviteeRow";

export declare namespace MemberRow {
    export interface Props {
        member: GetMembers200ResponseOneOfInner;
        currentUserId: Auth0UserID;
    }
}

export function MemberRow({ member, currentUserId }: MemberRow.Props) {
    const orgName = useOrgNameFromPathname();
    const queryKey = ReactQueryKey.orgMembers(orgName);
    const router = useRouter();
    const organizations = useOrganizations();

    const queryClient = useQueryClient();
    const isCurrentUser = currentUserId === member.user_id;

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
                if (remainingOrgs.length > 0) {
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
        <MemberOrInviteeRow
            title={member.name}
            subtitle={member.email}
            pictureUrl={member.picture}
            dropdownMenuItems={
                <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                        removeMember.mutate();
                    }}
                >
                    <UserMinusIcon /> {isCurrentUser ? "Leave organization" : "Remove member"}
                </DropdownMenuItem>
            }
        />
    );
}
