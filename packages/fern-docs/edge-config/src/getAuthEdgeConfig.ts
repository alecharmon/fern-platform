import {
    type ApiKeyDemo,
    ApiKeySchema,
    type AuthEdgeConfig,
    AuthEdgeConfigOrListSchema,
    normalizeAuthConfigs
} from "@fern-api/docs-auth";
import { withoutStaging } from "@fern-api/docs-utils";

import { getEdge } from "./getEdge";
import { isLocal } from "./isLocal";
import { isSelfHosted } from "./isSelfHosted";

// since we store the workOS org name within the authentication entry
// we iterate through the entries to find ones that match the org name
export async function getWorkOSOrganizationDomains(orgName: string): Promise<string | undefined> {
    if (isLocal() || isSelfHosted()) {
        return undefined;
    }

    // get authentication record from edge config
    const domainToAuthConfigMap = await getEdge<Record<string, unknown>>("authentication");

    if (!domainToAuthConfigMap) {
        return undefined;
    }

    const domains: string[] = [];

    // iterate through all domains and their auth configs
    for (const [domain, authConfig] of Object.entries(domainToAuthConfigMap)) {
        const config = AuthEdgeConfigOrListSchema.safeParse(authConfig);

        if (config.success) {
            const configs = normalizeAuthConfigs(config.data);
            for (const c of configs) {
                if (c.type === "sso" && c.partner === "workos") {
                    // if the orgName matches the organization field, return the domain
                    if (c.organization === orgName) {
                        domains.push(domain);
                        break;
                    }
                }
            }
        } else {
            console.error(`Could not parse AuthEdgeConfig for ${domain}`, config.error);
        }
    }

    // prefer a non-buildwithfern domain, if it exists
    if (domains.length > 0) {
        for (const domain of domains) {
            if (!domain.endsWith("docs.buildwithfern.com")) {
                return domain;
            }
        }

        return domains[0];
    }

    return undefined;
}

export async function getAuthEdgeConfig(currentDomain: string): Promise<AuthEdgeConfig | undefined> {
    if (isLocal() || isSelfHosted()) {
        return undefined;
    }

    return getRecord(currentDomain, "authentication");
}

export async function getAuthEdgeConfigs(currentDomain: string): Promise<AuthEdgeConfig[]> {
    if (isLocal() || isSelfHosted()) {
        return [];
    }

    return getRecords(currentDomain, "authentication");
}

export async function getApiKeyInjectionEdgeConfig(currentDomain: string): Promise<AuthEdgeConfig | undefined> {
    if (isLocal() || isSelfHosted()) {
        return undefined;
    }

    return getRecord(currentDomain, "api-key-injection");
}

// hard-coded api key for demo purposes
export async function getApiKeyInjectionDemoConfig(currentDomain: string): Promise<ApiKeyDemo | undefined> {
    if (isLocal()) {
        return undefined;
    }

    const domainToTokenConfigMap = await getEdge<Record<string, any>>("api-key-injection-demo");
    const toRet = domainToTokenConfigMap?.[currentDomain] ?? domainToTokenConfigMap?.[withoutStaging(currentDomain)];
    if (toRet != null) {
        const config = ApiKeySchema.safeParse(toRet);
        // if the config is present, it should be valid.
        // if it's malformed, custom auth for this domain will not work and may leak docs to the public.
        if (!config.success) {
            console.error(`Could not parse ApiKeySchema for ${currentDomain}`, config.error);
            // TODO: sentry
        }
        return config.data;
    }
    return;
}

async function getRecord(currentDomain: string, key: string): Promise<AuthEdgeConfig | undefined> {
    const records = await getRecords(currentDomain, key);
    return records[0];
}

async function getRecords(currentDomain: string, key: string): Promise<AuthEdgeConfig[]> {
    const domainToTokenConfigMap = await getEdge<Record<string, any>>(key);
    const toRet = domainToTokenConfigMap?.[currentDomain] ?? domainToTokenConfigMap?.[withoutStaging(currentDomain)];
    if (toRet != null) {
        const config = AuthEdgeConfigOrListSchema.safeParse(toRet);
        // if the config is present, it should be valid.
        // if it's malformed, custom auth for this domain will not work and may leak docs to the public.
        if (!config.success) {
            console.error(`Could not parse AuthEdgeConfigSchema for ${currentDomain}`, config.error);
            // TODO: sentry
            return [];
        }
        return normalizeAuthConfigs(config.data);
    }
    return [];
}
