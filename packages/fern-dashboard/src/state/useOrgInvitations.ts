"use client";

import { useQuery } from "@tanstack/react-query";

import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";

import { convertQueryResultToLoadable } from "./convertQueryResultToLoadable";
import { ReactQueryKey, type inferQueryData } from "./queryKeys";
import type { OrgInvitation } from "./types";

export function useOrgInvitations() {
    const orgName = useOrgNameFromPathname();
    const queryKey = ReactQueryKey.orgInvitations(orgName);

    return convertQueryResultToLoadable(
        useQuery<inferQueryData<typeof queryKey>>({
            queryKey: queryKey,
            queryFn: async () => {
                const invitations = await DashboardApiClient.getOrgInvitations({
                    orgName
                });
                return invitations.map(
                    (invitation): OrgInvitation => ({
                        id: invitation.id,
                        inviteeEmail: invitation.invitee.email
                    })
                );
            }
        })
    );
}
