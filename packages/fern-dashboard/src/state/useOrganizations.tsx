"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";

import { convertQueryResultToLoadable } from "./convertQueryResultToLoadable";
import { type inferQueryData, ReactQueryKey } from "./queryKeys";

export function useOrganizations(orgName?: Auth0OrgName) {
    const queryKey = orgName ? ReactQueryKey.myOrganizations(orgName) : ReactQueryKey.myOrganizations();
    return convertQueryResultToLoadable(
        useQuery<inferQueryData<typeof queryKey>>({
            queryKey,
            queryFn: () => DashboardApiClient.getMyOrganizations(orgName)
        })
    );
}

export function useOrganization(orgName: Auth0OrgName) {
    const organizations = useOrganizations(orgName);
    if (organizations.type !== "loaded") {
        return undefined;
    }
    return organizations.value.find((org) => org.name === orgName);
}

export function useCurrentOrganization() {
    const orgName = useOrgNameFromPathname();
    return useOrganization(orgName);
}

export function useInvalidateOrganizations() {
    const queryClient = useQueryClient();
    return () => queryClient.invalidateQueries({ queryKey: ReactQueryKey.myOrganizations() });
}
