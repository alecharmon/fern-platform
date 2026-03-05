"use server";

import { Redis } from "@upstash/redis";

import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import type { Auth0OrgName } from "../services/auth0/types";
import { assertUserHasOrganizationAccess } from "../services/dal/organization";

const DOMAIN_SETTINGS_KEY_PREFIX = "domain-settings";
const BASEPATH_ROUTES_KEY_PREFIX = "basepath-routes";

/**
 * Get a Redis client for the middleware KV store (where basepath-routes and domain-settings live).
 * This uses MWARE_KV_* env vars — the same Upstash instance the docs middleware reads from.
 * This is separate from the dashboard's own KV (KV_REST_API_URL).
 */
let mwareRedis: Redis | undefined;
function getMwareRedisClient(): Redis {
    if (mwareRedis == null) {
        const url = process.env.MWARE_KV_REST_API_URL;
        const token = process.env.MWARE_KV_REST_API_TOKEN;
        if (!url || !token) {
            throw new Error("MWARE_KV_REST_API_URL and MWARE_KV_REST_API_TOKEN must be set");
        }
        mwareRedis = new Redis({ url, token });
    }
    return mwareRedis;
}

export type SearchBehavior = "hierarchical" | "unified";

export interface DomainSettings {
    defaultBasepath?: string;
    searchBehavior?: SearchBehavior;
}

/**
 * Read basepath routes for a domain from the middleware Upstash instance.
 * Returns the list of basepaths (e.g. ["/docs", "/api-reference"]) or undefined if none exist.
 */
export async function getBasepathRoutes({
    domain,
    orgName
}: {
    domain: string;
    orgName: Auth0OrgName;
}): Promise<string[] | undefined> {
    const session = await getCurrentSessionOrThrow();
    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    const key = `${BASEPATH_ROUTES_KEY_PREFIX}:${domain}`;
    try {
        const basepaths = await getMwareRedisClient().hkeys(key);
        return basepaths.length > 0 ? basepaths : undefined;
    } catch (error) {
        console.error(`[getBasepathRoutes] Failed to get basepath routes for ${domain}`, error);
        return undefined;
    }
}

export async function getDomainSettings({
    domain,
    orgName
}: {
    domain: string;
    orgName: Auth0OrgName;
}): Promise<DomainSettings | undefined> {
    const session = await getCurrentSessionOrThrow();
    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    const key = `${DOMAIN_SETTINGS_KEY_PREFIX}:${domain}`;
    try {
        const settings = await getMwareRedisClient().hgetall(key);
        if (settings == null || Object.keys(settings).length === 0) {
            return undefined;
        }
        return settings as DomainSettings;
    } catch (error) {
        console.error(`[getDomainSettings] Failed to get domain settings for ${domain}`, error);
        return undefined;
    }
}

export async function setDomainDefaultBasepath({
    domain,
    orgName,
    defaultBasepath
}: {
    domain: string;
    orgName: Auth0OrgName;
    defaultBasepath: string;
}): Promise<void> {
    const session = await getCurrentSessionOrThrow();
    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    const key = `${DOMAIN_SETTINGS_KEY_PREFIX}:${domain}`;
    try {
        if (defaultBasepath.trim() === "") {
            await getMwareRedisClient().hdel(key, "defaultBasepath");
        } else {
            const normalized = defaultBasepath.startsWith("/") ? defaultBasepath : `/${defaultBasepath}`;
            await getMwareRedisClient().hset(key, { defaultBasepath: normalized });
        }
    } catch (error) {
        console.error(`[setDomainDefaultBasepath] Failed to set default basepath for ${domain}`, error);
        throw new Error("Failed to save default path");
    }
}

export async function setDomainSearchBehavior({
    domain,
    orgName,
    searchBehavior
}: {
    domain: string;
    orgName: Auth0OrgName;
    searchBehavior: SearchBehavior;
}): Promise<void> {
    const session = await getCurrentSessionOrThrow();
    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    const key = `${DOMAIN_SETTINGS_KEY_PREFIX}:${domain}`;
    try {
        await getMwareRedisClient().hset(key, { searchBehavior });
    } catch (error) {
        console.error(`[setDomainSearchBehavior] Failed to set search behavior for ${domain}`, error);
        throw new Error("Failed to save search behavior");
    }
}
