"use client";

import { useQuery } from "@tanstack/react-query";

import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";

import { convertQueryResultToLoadable } from "./convertQueryResultToLoadable";
import { ReactQueryKey } from "./queryKeys";

export function useOrgMembers() {
    const orgName = useOrgNameFromPathname();

    return convertQueryResultToLoadable(
        useQuery({
            queryKey: ReactQueryKey.orgMembers(orgName),
            queryFn: () => DashboardApiClient.getOrgMembers({ orgName })
        })
    );
}
