import { isLocal } from "@fern-api/docs-server/isLocal";
import { Redis } from "@upstash/redis";

import { isSelfHosted } from "./isSelfHosted";

const BASEPATH_ROUTES_KEY_PREFIX = "basepath-routes";

const CACHE_TTL_MS = 60 * 1000;

interface CacheEntry {
    value: string[];
    timestamp: number;
}

const basepathCache = new Map<string, CacheEntry>();

let redis: Redis | undefined;

function getRedisClient(): Redis {
    if (redis == null) {
        redis = new Redis({
            url: process.env.MWARE_KV_REST_API_URL,
            token: process.env.MWARE_KV_REST_API_TOKEN
        });
    }
    return redis;
}

export async function getBasepathRoutes(domain: string): Promise<string[] | undefined> {
    if (isLocal() || isSelfHosted()) {
        return undefined;
    }

    const cached = basepathCache.get(domain);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.value.length > 0 ? cached.value : undefined;
    }

    const key = `${BASEPATH_ROUTES_KEY_PREFIX}:${domain}`;
    try {
        const start = Date.now();
        const basepaths = await getRedisClient().hkeys(key);
        console.log(
            `[getBasepathRoutes] redis hkeys ${key} took ${Date.now() - start}ms, found ${basepaths.length} basepaths`
        );

        basepathCache.set(domain, { value: basepaths, timestamp: Date.now() });

        return basepaths.length > 0 ? basepaths : undefined;
    } catch (error) {
        console.error(`[getBasepathRoutes] redis hkeys ${key} failed:`, error);
        return undefined;
    }
}
