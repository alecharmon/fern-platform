import { type ApiKeyDemo, ApiKeySchema, type AuthEdgeConfig, AuthEdgeConfigSchema } from "@fern-api/docs-auth";
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
        const config = AuthEdgeConfigSchema.safeParse(authConfig);

        if (!config.success) {
            // Only log errors when parsing actually fails, not when the config is a different type
            console.error(`Could not parse AuthEdgeConfig for ${domain}`, config.error.message);
            continue;
        }

        if (config.data.type === "sso" && config.data.partner === "workos") {
            // if the orgName matches the organization field, return the domain
            if (config.data.organization === orgName) {
                domains.push(domain);
            }
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
    const selfHosted = isSelfHosted();
    const local = isLocal();
    console.log("[self-hosted-auth] getAuthEdgeConfig called", {
        currentDomain,
        isLocal: local,
        isSelfHosted: selfHosted
    });

    if (local) {
        return undefined;
    }

    if (selfHosted) {
        return getSelfHostedAuthConfig();
    }

    return getRecord(currentDomain, "authentication");
}

function getSelfHostedAuthConfig(): AuthEdgeConfig | undefined {
    const authType = process.env.FERN_AUTH_TYPE;
    console.log("[self-hosted-auth] getSelfHostedAuthConfig called", {
        FERN_AUTH_TYPE: authType ?? "[absent]",
        FERN_AUTH_SECRET: process.env.FERN_AUTH_SECRET
            ? `[set, len=${process.env.FERN_AUTH_SECRET.length}]`
            : "[absent]",
        JWT_SECRET_KEY: process.env.JWT_SECRET_KEY ? `[set, len=${process.env.JWT_SECRET_KEY.length}]` : "[absent]",
        NEXT_PUBLIC_IS_SELF_HOSTED: process.env.NEXT_PUBLIC_IS_SELF_HOSTED ?? "[absent]"
    });
    if (!authType) {
        console.log("[self-hosted-auth] No FERN_AUTH_TYPE set, returning undefined");
        return undefined;
    }

    const allowlist = process.env.FERN_AUTH_ALLOWLIST?.split(",").filter(Boolean);
    const denylist = process.env.FERN_AUTH_DENYLIST?.split(",").filter(Boolean);

    let raw: Record<string, unknown>;

    switch (authType) {
        case "basic_token_verification":
            raw = {
                type: "basic_token_verification" as const,
                secret: process.env.FERN_AUTH_SECRET ?? "",
                issuer: process.env.FERN_AUTH_ISSUER ?? "",
                redirect: process.env.FERN_AUTH_REDIRECT ?? "",
                logout: process.env.FERN_AUTH_LOGOUT,
                returnToQueryParam: process.env.FERN_AUTH_RETURN_TO_QUERY_PARAM,
                "api-key-injection-enabled":
                    process.env.FERN_API_KEY_INJECTION_ENABLED === "true" ||
                    process.env.FERN_API_KEY_INJECTION_ENABLED === "1",
                allowlist,
                denylist
            };
            break;
        case "password":
            raw = {
                type: "password" as const,
                password: process.env.FERN_AUTH_SECRET ?? "",
                allowlist,
                denylist
            };
            break;
        case "oauth2":
            raw = {
                type: "oauth2" as const,
                partner: process.env.FERN_AUTH_PARTNER ?? "",
                clientId: process.env.FERN_AUTH_CLIENT_ID ?? "",
                clientSecret: process.env.FERN_AUTH_CLIENT_SECRET ?? "",
                auth_endpoint: process.env.FERN_AUTH_ENDPOINT ?? "",
                token_endpoint: process.env.FERN_AUTH_TOKEN_ENDPOINT ?? "",
                redirectUri: process.env.FERN_AUTH_REDIRECT,
                scope: process.env.FERN_AUTH_SCOPE,
                issuer: process.env.FERN_AUTH_ISSUER,
                roles_claim: process.env.FERN_AUTH_ROLES_CLAIM,
                "api-key-injection-enabled":
                    process.env.FERN_API_KEY_INJECTION_ENABLED === "true" ||
                    process.env.FERN_API_KEY_INJECTION_ENABLED === "1",
                allowlist,
                denylist
            };
            break;
        case "sso":
            raw = {
                type: "sso" as const,
                partner: "workos" as const,
                organization: process.env.FERN_AUTH_ORGANIZATION ?? "",
                connection: process.env.FERN_AUTH_CONNECTION,
                provider: process.env.FERN_AUTH_PROVIDER,
                allowlist,
                denylist
            };
            break;
        default:
            console.error(`[self-hosted] Unknown FERN_AUTH_TYPE: ${authType}`);
            return undefined;
    }

    console.log("[self-hosted-auth] Built raw config:", {
        type: raw.type,
        hasPassword:
            "password" in raw && typeof raw.password === "string"
                ? `[set, len=${(raw.password as string).length}]`
                : "[absent]",
        keys: Object.keys(raw)
    });

    const result = AuthEdgeConfigSchema.safeParse(raw);
    if (result.success) {
        console.log("[self-hosted-auth] Config parsed successfully, type:", result.data.type);
        return result.data;
    }
    console.error("[self-hosted-auth] Schema validation FAILED:", result.error.message);
    console.error("[self-hosted-auth] Schema validation issues:", JSON.stringify(result.error.issues, null, 2));
    return undefined;
}

export async function getApiKeyInjectionEdgeConfig(currentDomain: string): Promise<AuthEdgeConfig | undefined> {
    if (isLocal()) {
        return undefined;
    }

    if (isSelfHosted()) {
        return getSelfHostedApiKeyInjectionConfig();
    }

    return getRecord(currentDomain, "api-key-injection");
}

function getSelfHostedApiKeyInjectionConfig(): AuthEdgeConfig | undefined {
    const enabled =
        process.env.FERN_API_KEY_INJECTION_ENABLED === "true" || process.env.FERN_API_KEY_INJECTION_ENABLED === "1";
    if (!enabled) {
        return undefined;
    }

    const injectionType = process.env.FERN_API_KEY_INJECTION_TYPE;
    if (!injectionType) {
        return undefined;
    }

    let raw: Record<string, unknown>;

    switch (injectionType) {
        case "basic_token_verification":
            raw = {
                type: "basic_token_verification" as const,
                secret: process.env.FERN_API_KEY_INJECTION_SECRET ?? "",
                issuer: process.env.FERN_API_KEY_INJECTION_ISSUER ?? "",
                redirect: process.env.FERN_API_KEY_INJECTION_REDIRECT ?? "",
                logout: process.env.FERN_API_KEY_INJECTION_LOGOUT,
                returnToQueryParam: process.env.FERN_API_KEY_INJECTION_RETURN_TO_QUERY_PARAM,
                "api-key-injection-enabled": true
            };
            break;
        case "oauth2":
            raw = {
                type: "oauth2" as const,
                partner: process.env.FERN_API_KEY_INJECTION_PARTNER ?? "",
                clientId: process.env.FERN_API_KEY_INJECTION_CLIENT_ID ?? "",
                clientSecret: process.env.FERN_API_KEY_INJECTION_CLIENT_SECRET ?? "",
                auth_endpoint: process.env.FERN_API_KEY_INJECTION_ENDPOINT ?? "",
                token_endpoint: process.env.FERN_API_KEY_INJECTION_TOKEN_ENDPOINT ?? "",
                redirectUri: process.env.FERN_API_KEY_INJECTION_REDIRECT,
                scope: process.env.FERN_API_KEY_INJECTION_SCOPE,
                issuer: process.env.FERN_API_KEY_INJECTION_ISSUER,
                "api-key-injection-enabled": true
            };
            break;
        default:
            console.error(`[self-hosted] Unknown FERN_API_KEY_INJECTION_TYPE: ${injectionType}`);
            return undefined;
    }

    const result = AuthEdgeConfigSchema.safeParse(raw);
    if (result.success) {
        return result.data;
    }
    console.error("[self-hosted] API key injection config validation FAILED:", result.error.message);
    return undefined;
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
            console.error(`Could not parse ApiKeySchema for ${currentDomain}`, config.error.message);
            // TODO: sentry
        }
        return config.data;
    }
    return;
}

async function getRecord(currentDomain: string, key: string): Promise<AuthEdgeConfig | undefined> {
    const domainToTokenConfigMap = await getEdge<Record<string, any>>(key);
    const toRet = domainToTokenConfigMap?.[currentDomain] ?? domainToTokenConfigMap?.[withoutStaging(currentDomain)];
    if (toRet != null) {
        const config = AuthEdgeConfigSchema.safeParse(toRet);
        // if the config is present, it should be valid.
        // if it's malformed, custom auth for this domain will not work and may leak docs to the public.
        if (!config.success) {
            console.error(`Could not parse AuthEdgeConfigSchema for ${currentDomain}`, config.error.message);
            // TODO: sentry
        }
        return config.data;
    }
    return;
}
