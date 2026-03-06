"use cache";

import { cacheLife, cacheTag } from "next/cache";

import type { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";
import type { PosthogFeatureFlag } from "@/components/posthog/feature-flags/flags";
import { getServerSidePosthog } from "@/components/posthog/getServerSidePosthog";

/**
 * Cached version of feature flag checks.
 * Feature flags change infrequently, so we cache them for 5 minutes per flag+user+org.
 * This eliminates redundant PostHog calls across page navigations.
 */
export async function getCachedFeatureFlag(
    flag: PosthogFeatureFlag,
    userId: Auth0UserID,
    orgName: Auth0OrgName
): Promise<boolean> {
    cacheLife("minutes");
    cacheTag(`feature-flag:${flag}:${orgName}`);

    const posthog = getServerSidePosthog();
    const result = await posthog.isFeatureEnabled(flag, userId, {
        personProperties: {
            orgName: orgName
        }
    });
    return result ?? false;
}
