import { Redis } from "@upstash/redis";

import type { inferCachedData, RedisCacheKey, RedisCacheKeyType } from "./cacheKey";

let redis: Redis | undefined;

export function getRedisClient() {
    if (redis == null) {
        redis = new Redis({
            url: process.env.KV_REST_API_URL,
            token: process.env.KV_REST_API_TOKEN
        });
    }
    return redis;
}

export async function redisSet<T extends RedisCacheKeyType>(
    key: RedisCacheKey<T>,
    value: inferCachedData<T>,
    { ttlInSeconds }: { ttlInSeconds: number }
) {
    await getRedisClient().set<inferCachedData<T>>(key, value, {
        ex: ttlInSeconds
    });
}

export async function redisGet<T extends RedisCacheKeyType>(
    key: RedisCacheKey<T>
): Promise<inferCachedData<T> | undefined> {
    const value = await getRedisClient().get<inferCachedData<T>>(key);
    return value ?? undefined;
}

export async function redisDel<T extends RedisCacheKeyType>(key: RedisCacheKey<T>) {
    await getRedisClient().del(key);
}

export async function redisDelPattern(pattern: string) {
    const redis = getRedisClient();
    const keys: string[] = [];
    let cursor: string | number = 0;

    // Use SCAN to find all keys matching the pattern
    do {
        const result: any = await redis.scan(cursor, { match: pattern, count: 100 });
        cursor = result[0];
        keys.push(...result[1]);
        // Redis scan returns cursor as string '0' when done
    } while (cursor.toString() !== "0");

    // Delete all matching keys
    if (keys.length > 0) {
        await redis.del(...keys);
    }

    return keys.length;
}
