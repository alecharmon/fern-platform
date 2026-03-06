import {
    type AuthZPermission,
    getPermissionsFromSession,
    hasPermission,
    hasResourcePermission,
    type ResourceType
} from "@fern-api/user-permissions";
import { cacheLife, cacheTag } from "next/cache";
import { getOrgIdFromName } from "@/app/services/auth0/management";
import { Auth0OrgName, type Auth0UserID } from "@/app/services/auth0/types";
import { PosthogFeatureFlag } from "@/components/posthog/feature-flags/flags";
import { getServerSidePosthog } from "@/components/posthog/getServerSidePosthog";

/**
 * Check a PostHog feature flag directly (not via another "use cache" function).
 * This avoids the nested "use cache" issue that causes cacheLife() errors.
 */
async function checkFeatureFlag(flag: PosthogFeatureFlag, userId: Auth0UserID, orgName: string): Promise<boolean> {
    const posthog = getServerSidePosthog();
    const result = await posthog.isFeatureEnabled(flag, userId, {
        personProperties: {
            orgName: orgName
        }
    });
    return result ?? false;
}

/**
 * Cached permission check that avoids redundant Supabase calls on every navigation.
 * Returns whether the user is allowed to access the resource.
 *
 * Permissions are always enforced (ENFORCE_PERMISSIONS flag is fully rolled out).
 *
 * Cache key is derived from all arguments (userId, orgName, sortedPermissions, permission, resourceType, resourceId).
 * TTL is 1 minute to limit staleness when permissions change externally (e.g. via
 * Auth0 dashboard or API). The dashboard's own mutation paths call revalidateTag()
 * immediately, but external changes won't invalidate the cache until TTL expires.
 *
 * NOTE: sessionPermissions is sorted before being used as a cache key argument to
 * ensure consistent cache hits regardless of JWT claim ordering.
 */
export async function getCachedPermissionCheck(
    userId: Auth0UserID,
    orgName: string,
    sortedPermissions: string[],
    permission: AuthZPermission,
    resourceType: string,
    resourceId: string
): Promise<{ allowed: boolean }> {
    "use cache";
    cacheLife({ revalidate: 60 }); // 1-minute TTL — see docblock for tradeoff rationale
    cacheTag(`permissions:${orgName}:${userId}`);

    let isFineGrainedEnabled = false;
    try {
        isFineGrainedEnabled = await checkFeatureFlag(
            PosthogFeatureFlag.ENABLE_FINE_GRAINED_PERMISSIONS,
            userId,
            orgName
        );
    } catch (error) {
        console.error("[cachedPermissionCheck] Failed to check fine-grained permissions flag:", error);
    }

    let allowed: boolean;
    try {
        const orgId = await getOrgIdFromName(Auth0OrgName(orgName));
        allowed = await hasResourcePermission({
            sessionPermissions: sortedPermissions,
            userId,
            orgId,
            permissionToCheck: permission,
            resourceType: resourceType as ResourceType,
            resourceId,
            forceFineGrained: isFineGrainedEnabled
        });
    } catch (error) {
        console.error("[cachedPermissionCheck] Failed to check permissions:", error);
        allowed = false;
    }

    return { allowed };
}

/**
 * Cached org-level permission check (no resource scope).
 * Permissions are always enforced (ENFORCE_PERMISSIONS flag is fully rolled out).
 *
 * Same TTL / sorting rationale as getCachedPermissionCheck above.
 */
export async function getCachedOrgPermissionCheck(
    userId: Auth0UserID,
    orgName: string,
    sortedPermissions: string[],
    permission: AuthZPermission
): Promise<{ allowed: boolean }> {
    "use cache";
    cacheLife({ revalidate: 60 }); // 1-minute TTL
    cacheTag(`permissions:${orgName}:${userId}`);

    const orgPermissions = getPermissionsFromSession({ sessionPermissions: sortedPermissions });
    const allowed = hasPermission(orgPermissions, permission);

    return { allowed };
}
