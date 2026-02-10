import type { EntitlementKey } from "../types";
import { getDocsSitesUsage } from "./docs-sites";
import { getSeatsUsage } from "./seats";

/**
 * Interface that consumers implement to provide current usage counts.
 * The entitlements package never knows HOW to count things —
 * it just knows the contract.
 */
export interface UsageProvider {
    getCurrentUsage(orgId: string, key: EntitlementKey): Promise<number>;
}

const usageHandlers: Record<EntitlementKey, (orgId: string) => Promise<number>> = {
    seats: getSeatsUsage,
    docs_sites: getDocsSitesUsage
};

/**
 * Default UsageProvider that routes to the per-key usage functions.
 */
export function createUsageProvider(): UsageProvider {
    return {
        getCurrentUsage: (orgId, key) => usageHandlers[key](orgId)
    };
}
