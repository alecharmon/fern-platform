import "server-only";

import { RedisCacheKey } from "@/app/services/redis/cacheKey";
import { redisDel, redisDelPattern } from "@/app/services/redis/redis";

/**
 * Invalidate validation cache for a specific org, site, and git URL.
 * Use this when you know all three parameters (e.g., after connecting a repo).
 *
 * @param orgName - The Fern organization name
 * @param site - The docs site URL
 * @param gitUrl - The git repository URL
 */
export async function invalidateValidateGitRepoAccessCache(
    orgName: string,
    site: string,
    gitUrl: string
): Promise<void> {
    const cacheKey = RedisCacheKey.validateGitRepoAccess(orgName, site, gitUrl);
    await redisDel(cacheKey);
}

/**
 * Invalidate all validation cache entries for a specific git URL across all orgs and sites.
 * Use this when repo configuration changes affect all connections (e.g., when clearing GitHub loader cache).
 *
 * @param gitUrl - The git repository URL
 */
export async function invalidateValidateGitRepoAccessCacheForRepo(gitUrl: string): Promise<void> {
    // Pattern: validate-git-repo-access:*:*:${gitUrl}
    await redisDelPattern(`validate-git-repo-access:*:*:${gitUrl}`);
}
