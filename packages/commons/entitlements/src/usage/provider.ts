import type { NumericEntitlementKey } from "../types";
import { getDocsSitesUsage } from "./docs-sites";
import { getSeatsUsage } from "./seats";

/**
 * Interface that consumers implement to provide current usage counts.
 * The entitlements package never knows HOW to count things —
 * it just knows the contract.
 */
export interface UsageProvider {
    getCurrentUsage(orgId: string, key: NumericEntitlementKey): Promise<number>;
}

const defaultHandlers: Record<NumericEntitlementKey, (orgId: string) => Promise<number>> = {
    seats: getSeatsUsage,
    docs_sites: getDocsSitesUsage,
    ai_credits: async (_orgId: string) => 0
};

/**
 * Per-key override map. Callers can override specific keys while falling
 * back to the default handlers for the rest.
 */
export type UsageHandlerOverrides = Partial<Record<NumericEntitlementKey, (orgId: string) => Promise<number>>>;

/**
 * Default UsageProvider that routes to the per-key usage functions.
 * Pass overrides to replace specific handlers (e.g. docs_sites) while
 * keeping defaults for the rest.
 */
export function createUsageProvider(overrides?: UsageHandlerOverrides): UsageProvider {
    const handlers = { ...defaultHandlers, ...overrides };
    return {
        getCurrentUsage: (orgId, key) => handlers[key](orgId)
    };
}
