import { getOrgMembers } from "@/app/services/auth0/management";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { RedisCacheKey } from "@/app/services/redis/cacheKey";
import { redisSet } from "@/app/services/redis/redis";

/**
 * Marks all members of an org as having invalidated sessions.
 * This forces them to re-authenticate and pick up updated OIDC group mappings.
 */
export async function invalidateOrgSessions(orgName: Auth0OrgName): Promise<void> {
    const members = await getOrgMembers(orgName, { includeFernEmployees: true });

    await Promise.all(
        members.map((member) =>
            redisSet(RedisCacheKey.userSessionInvalidated(member.user_id), true, {
                ttlInSeconds: 60 * 60 * 24 * 365 // 1 year
            })
        )
    );

    console.log(`[invalidateOrgSessions] Invalidated ${members.length} sessions for org ${orgName}`);
}
