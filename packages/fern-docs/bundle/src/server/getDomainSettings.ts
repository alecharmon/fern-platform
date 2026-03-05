import { isLocal } from "@fern-api/docs-server/isLocal";
import { Redis } from "@upstash/redis";

import { isSelfHosted } from "./isSelfHosted";

const DOMAIN_SETTINGS_KEY_PREFIX = "domain-settings";

const CACHE_TTL_MS = 60 * 1000;

interface DomainSettings {
    defaultBasepath?: string;
    searchBehavior?: "hierarchical" | "unified";
}

interface CacheEntry {
    value: DomainSettings | undefined;
    timestamp: number;
}

const domainSettingsCache = new Map<string, CacheEntry>();

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

export async function getDomainSettings(domain: string): Promise<DomainSettings | undefined> {
    if (isLocal() || isSelfHosted()) {
        return undefined;
    }

    if (!process.env.MWARE_KV_REST_API_URL || !process.env.MWARE_KV_REST_API_TOKEN) {
        console.log(
            "[getDomainSettings] skipping redis lookup: MWARE_KV_REST_API_URL or MWARE_KV_REST_API_TOKEN is not set"
        );
        return undefined;
    }

    const cached = domainSettingsCache.get(domain);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.value;
    }

    const key = `${DOMAIN_SETTINGS_KEY_PREFIX}:${domain}`;
    try {
        const start = Date.now();
        const settings = await getRedisClient().hgetall(key);
        console.log(`[getDomainSettings] redis hgetall ${key} took ${Date.now() - start}ms`);

        const domainSettings =
            settings != null && Object.keys(settings).length > 0 ? (settings as DomainSettings) : undefined;

        domainSettingsCache.set(domain, { value: domainSettings, timestamp: Date.now() });

        return domainSettings;
    } catch (error) {
        console.error(`[getDomainSettings] redis hgetall ${key} failed:`, error);
        return undefined;
    }
}
