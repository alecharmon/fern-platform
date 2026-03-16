import { RedisCacheKey } from "../redis/cacheKey";
import { redisGet, redisSet } from "../redis/redis";

export const RECENT_PATH_TTL_IN_SECONDS = 7 * 24 * 60 * 60; // 7 days

export async function setRecentPath(userId: string, path: string): Promise<void> {
    const segments = path.split("/").filter(Boolean);
    const orgName = segments[0];
    if (!orgName) {
        return;
    }

    await redisSet(
        RedisCacheKey.userRecentPath(userId),
        {
            path,
            orgName,
            updatedAt: new Date().toISOString()
        },
        { ttlInSeconds: RECENT_PATH_TTL_IN_SECONDS }
    );
}

export async function getRecentPath(userId: string) {
    return await redisGet(RedisCacheKey.userRecentPath(userId));
}
