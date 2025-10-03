"use client";

import { useQuery } from "@tanstack/react-query";

import { Auth0OrgName } from "@/app/services/auth0/types";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";

import { convertQueryResultToLoadable } from "./convertQueryResultToLoadable";
import { ReactQueryKey, inferQueryData } from "./queryKeys";

const QUERY_KEY = ReactQueryKey.myOrganizations();

export function useOrganizations() {
    return convertQueryResultToLoadable(
        useQuery<inferQueryData<typeof QUERY_KEY>>({
            queryKey: QUERY_KEY,
            queryFn: () => DashboardApiClient.getMyOrganizations()
        })
    );
}

export function useOrganization(orgName: Auth0OrgName) {
    const organizations = useOrganizations();
    if (organizations.type !== "loaded") {
        return undefined;
    }
    return organizations.value.find((org) => org.name === orgName);
}

export function useCurrentOrganization() {
    const orgName = useOrgNameFromPathname();
    return useOrganization(orgName);
}
