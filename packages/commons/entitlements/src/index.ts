// @fern-platform/entitlements

export {
    createEntitlementsChecker,
    EntitlementChecker,
    type EntitlementsChecker,
    type EntitlementsCheckerOptions
} from "./check";
export { getGrantsForSkus, SKU_GRANTS } from "./grants";
export { EntitlementDeniedError, withEntitlement } from "./middleware";
export { type ResolvedEntitlements, type ResolvedGrant, resolveEntitlements } from "./resolve";
export type {
    EntitlementCheckResult,
    EntitlementDefinition,
    EntitlementGrant,
    EntitlementKey,
    EntitlementType,
    MergeStrategy,
    OveragePolicy
} from "./types";
export { ENTITLEMENT_DEFINITIONS } from "./types";
export { createUsageCache, type UsageCache } from "./usage/cache";
export type { UsageProvider } from "./usage/provider";
export { createUsageProvider } from "./usage/provider";
