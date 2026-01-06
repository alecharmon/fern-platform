"use client";

import { useQuery } from "@tanstack/react-query";

import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";

import { convertQueryResultToLoadable } from "./convertQueryResultToLoadable";
import { ReactQueryKey } from "./queryKeys";

export function useOrgMembers() {
    const orgName = useOrgNameFromPathname();
    const query = useQuery({
        queryKey: ReactQueryKey.orgMembers(orgName),
        queryFn: () => DashboardApiClient.getOrgMembers({ orgName })
    });

    return {
        members: convertQueryResultToLoadable(query),
        refetch: query.refetch
    };
}
