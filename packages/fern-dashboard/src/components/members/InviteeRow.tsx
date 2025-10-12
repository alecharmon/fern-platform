import ClockIcon from "@heroicons/react/24/outline/ClockIcon";
import UserMinusIcon from "@heroicons/react/24/outline/UserMinusIcon";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { rescindInvitation } from "@/app/actions/rescindInvitation";
import { type inferQueryData, ReactQueryKey } from "@/state/queryKeys";
import type { OrgInvitation } from "@/state/types";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";

import { DropdownMenuItem } from "../ui/dropdown-menu";
import { MemberOrInviteeRow } from "./MemberOrInviteeRow";

export declare namespace InviteeRow {
    export interface Props {
        invitation: OrgInvitation;
    }
}

export function InviteeRow({ invitation }: InviteeRow.Props) {
    const orgName = useOrgNameFromPathname();
    const queryKey = ReactQueryKey.orgInvitations(orgName);

    const queryClient = useQueryClient();
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
        onError: async (error, _variables, context) => {
            console.error(`Failed to rescind invitation to ${invitation.inviteeEmail}`, error);
            toast.error(`Failed to rescind invitation to ${invitation.inviteeEmail}`);
            if (context?.previousInvitations != null) {
                queryClient.setQueryData<inferQueryData<typeof queryKey>>(queryKey, context.previousInvitations);
            }

            // only invalidate on error. if we invalidate on success, we can wipe
            // out other optimsitic writes (if the user is rescinding multiple invites)
            await queryClient.invalidateQueries({ queryKey });
        }
    });

    return (
        <MemberOrInviteeRow
            title={invitation.inviteeEmail}
            rightContent={
                <div className="text-gray-1100 flex items-center gap-2">
                    <ClockIcon className="size-5" />
                    Pending
                </div>
            }
            dropdownMenuItems={
                <>
                    <DropdownMenuItem
                        variant="destructive"
                        onClick={() => {
                            rescind.mutate();
                        }}
                        disabled={invitation.id == null}
                    >
                        <UserMinusIcon /> Rescind invitation
                    </DropdownMenuItem>
                </>
            }
        />
    );
}
