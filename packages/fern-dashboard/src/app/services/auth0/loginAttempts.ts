import { v4 as uuidv4 } from "uuid";

import type { LoginAttempt } from "../redis/cacheKey";
import { RedisCacheKey } from "../redis/cacheKey";
import { getRedisClient, redisDel, redisGet, redisSet } from "../redis/redis";

export const LOGIN_ATTEMPT_TTL_IN_SECONDS = 15 * 60;

export async function createLoginAttempt(loginAttempt: Omit<LoginAttempt, "createdAt">): Promise<string> {
    const id = uuidv4();

    await redisSet(
        RedisCacheKey.loginAttempt(id),
        {
            ...loginAttempt,
            createdAt: new Date().toISOString()
        },
        { ttlInSeconds: LOGIN_ATTEMPT_TTL_IN_SECONDS }
    );

    return id;
}

export async function getLoginAttempt(id: string): Promise<LoginAttempt | undefined> {
    return await redisGet(RedisCacheKey.loginAttempt(id));
}

export async function deleteLoginAttempt(id: string): Promise<void> {
    await redisDel(RedisCacheKey.loginAttempt(id));
}

export async function consumeLoginAttempt(id: string): Promise<LoginAttempt | undefined> {
    const loginAttempt = await getRedisClient().getdel<LoginAttempt>(RedisCacheKey.loginAttempt(id));
    return loginAttempt ?? undefined;
}
