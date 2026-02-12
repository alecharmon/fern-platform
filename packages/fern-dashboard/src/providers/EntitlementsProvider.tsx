"use client";

import type { EntitlementCheckResult, EntitlementKey } from "@fern-platform/entitlements";
import { useQuery } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useMemo } from "react";

import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";

import { ReactQueryKey } from "../state/queryKeys";

type EntitlementsContextValue = {
    entitlements: Record<EntitlementKey, EntitlementCheckResult> | undefined;
    isLoading: boolean;
    refetch: () => void;
};

const EntitlementsContext = createContext<EntitlementsContextValue>({
    entitlements: undefined,
    isLoading: true,
    refetch: () => {}
});

export function EntitlementsProvider({ children }: { children: ReactNode }) {
    const orgName = useOrgNameFromPathname();
    const query = useQuery({
        queryKey: ReactQueryKey.orgEntitlements(orgName),
        queryFn: () => DashboardApiClient.getOrgEntitlements({ orgName })
    });

    const value = useMemo(
        () => ({
            entitlements: query.data,
            isLoading: query.isLoading,
            refetch: query.refetch
        }),
        [query.data, query.isLoading, query.refetch]
    );

    return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
}

export function useEntitlements() {
    return useContext(EntitlementsContext);
}
