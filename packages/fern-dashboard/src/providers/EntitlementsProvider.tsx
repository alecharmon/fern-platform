"use client";

import type { EntitlementCheckResult, EntitlementKey } from "@fern-platform/entitlements";
import { useQuery } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useMemo } from "react";

import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";

import { ReactQueryKey } from "../state/queryKeys";

type EntitlementsData = Record<EntitlementKey, EntitlementCheckResult>;

type EntitlementsContextValue = {
    entitlements: EntitlementsData | undefined;
    isFernEmployee: boolean;
    isLoading: boolean;
    refetch: () => Promise<EntitlementsData | undefined>;
};

const EntitlementsContext = createContext<EntitlementsContextValue>({
    entitlements: undefined,
    isFernEmployee: false,
    isLoading: true,
    refetch: () => Promise.resolve(undefined)
});

export function EntitlementsProvider({ children }: { children: ReactNode }) {
    const orgName = useOrgNameFromPathname();
    const query = useQuery({
        queryKey: ReactQueryKey.orgEntitlements(orgName),
        queryFn: () => DashboardApiClient.getOrgEntitlements({ orgName })
    });

    const refetch = useCallback(async () => {
        const result = await query.refetch();
        return result.data?.entitlements;
    }, [query.refetch]);

    const value = useMemo(
        () => ({
            entitlements: query.data?.entitlements,
            isFernEmployee: query.data?.isFernEmployee ?? false,
            isLoading: query.isLoading,
            refetch
        }),
        [query.data, query.isLoading, refetch]
    );

    return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
}

export function useEntitlements() {
    return useContext(EntitlementsContext);
}
