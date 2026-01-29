import z from "zod";

import { getAllEdge } from "./getEdge";
import { isLocal } from "./isLocal";
import { isSelfHosted } from "./isSelfHosted";

const SUPPORTED_PLATFORMS_KEY = "dashboard-email-login-supported-platforms";
const CONNECTION_TO_ORG_KEY = "dashboard-email-login-connection-to-org";

const SupportedPlatformSchema = z.string().min(1);
const SsoOrgEntrySchema = z.object({
    org_id: z.string(),
    org_name: z.string(),
    // We use this as a fallback when creating new users in the org via email
    default_email_domain: z.string().optional(),
    // default auth0 role to assign to users logging in via this SSO connection
    default_role: z.enum(["admin", "editor", "viewer"]).optional()
});

const EmailLoginConfigSchema = z.object({
    [SUPPORTED_PLATFORMS_KEY]: z.array(SupportedPlatformSchema).optional(),
    [CONNECTION_TO_ORG_KEY]: z.record(SsoOrgEntrySchema).optional()
});

const EDGE_CONFIG_KEYS = [SUPPORTED_PLATFORMS_KEY, CONNECTION_TO_ORG_KEY] as const;

export type EmailLoginSupportedPlatform = z.infer<typeof SupportedPlatformSchema>;
export type EmailLoginSsoEntry = z.infer<typeof SsoOrgEntrySchema>;
export type EmailLoginSsoMap = Record<string, EmailLoginSsoEntry>;
export type EmailLoginSsoDefaultEmailMap = Record<string, EmailLoginSsoEntry & { connection: string }>;

export interface EmailLoginConfig {
    supportedPlatforms: EmailLoginSupportedPlatform[];
    connectionToOrg: EmailLoginSsoMap;
    byEmailDomain: EmailLoginSsoDefaultEmailMap;
}

function getDefaultSupportedPlatforms(): EmailLoginSupportedPlatform[] {
    const raw = process.env.DASHBOARD_EMAIL_LOGIN_SUPPORTED_PLATFORMS_DEFAULT;
    const parsed = raw
        ?.split(",")
        .map((platform) => platform.trim())
        .filter((platform): platform is EmailLoginSupportedPlatform => platform.length > 0);

    return parsed && parsed.length > 0 ? parsed : (["samlp", "google-oauth2", "github"] as const);
}

function getDefaultConnectionToOrg(): EmailLoginSsoMap {
    const raw = process.env.DASHBOARD_EMAIL_LOGIN_CONNECTION_TO_ORG_DEFAULT;
    if (!raw) {
        return {};
    }

    try {
        const parsed = JSON.parse(raw) as unknown;
        const validation = z.record(SsoOrgEntrySchema).safeParse(parsed);
        if (!validation.success) {
            console.error("[get-email-login-config] Invalid connectionToOrg env default", validation.error.message);
            return {};
        }
        return validation.data;
    } catch (error) {
        console.error("[get-email-login-config] Failed to parse connectionToOrg env default", error);
        return {};
    }
}

function connectionToOrgByEmailDomain(connectionToOrg: EmailLoginSsoMap): EmailLoginSsoDefaultEmailMap {
    const map: EmailLoginSsoDefaultEmailMap = {};
    for (const [connection, entry] of Object.entries(connectionToOrg)) {
        if (entry.default_email_domain) {
            map[entry.default_email_domain] = { ...entry, connection };
        }
    }
    return map;
}

const DEFAULT_CONFIG: EmailLoginConfig = {
    supportedPlatforms: getDefaultSupportedPlatforms(),
    connectionToOrg: getDefaultConnectionToOrg(),
    byEmailDomain: connectionToOrgByEmailDomain(getDefaultConnectionToOrg())
};

export async function getEmailLoginConfig(): Promise<EmailLoginConfig> {
    if (isLocal() || isSelfHosted()) {
        return DEFAULT_CONFIG;
    }

    try {
        const edgeConfig = await getAllEdge<Record<(typeof EDGE_CONFIG_KEYS)[number], unknown>>(EDGE_CONFIG_KEYS);
        const parsed = EmailLoginConfigSchema.safeParse(edgeConfig);

        if (!parsed.success) {
            console.error("[get-email-login-config] Failed to parse edge config", parsed.error.message);
            return DEFAULT_CONFIG;
        }

        const supportedPlatformsFromEdge = parsed.data[SUPPORTED_PLATFORMS_KEY];
        const supportedPlatforms =
            supportedPlatformsFromEdge != null && supportedPlatformsFromEdge.length > 0
                ? supportedPlatformsFromEdge
                : DEFAULT_CONFIG.supportedPlatforms;

        const connectionToOrg = parsed.data[CONNECTION_TO_ORG_KEY] ?? DEFAULT_CONFIG.connectionToOrg;
        return {
            supportedPlatforms,
            connectionToOrg,
            byEmailDomain: connectionToOrgByEmailDomain(connectionToOrg)
        };
    } catch (error) {
        console.error("[get-email-login-config] Failed to fetch edge config", error);
        return DEFAULT_CONFIG;
    }
}
