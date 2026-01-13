import "server-only";

import { get as getEdge } from "@vercel/edge-config";

const GITHUB_ENTERPRISE_CONFIG_EDGE_KEY = "github_enterprise_config";

export interface GheConfig {
    appId: string;
    privateKeyBase64: string;
    organization: string;
    /** The actual GHE instance URL (used for constructing repo URLs, etc.) */
    baseUrl: string;
    /** The proxy URL to use for API requests (may be different from baseUrl if using CF tunnel) */
    proxyUrl: string;
    /** Cloudflare Access Client ID for authenticating through CF tunnel */
    cfAccessClientId?: string;
    /** Cloudflare Access Client Secret for authenticating through CF tunnel */
    cfAccessClientSecret?: string;
}

/**
 * Edge config structure for githubEnterprise.
 * Keyed by the host of the GHE instance (e.g., "github.mycompany.com").
 */
type GheConfigStructure = Record<
    string,
    {
        appId: string;
        privateKeyBase64: string;
        organization: string;
        /** Optional proxy URL for API requests (if using CF tunnel). Defaults to https://{host} */
        proxyUrl?: string;
        /** Cloudflare Access Client ID */
        cfAccessClientId?: string;
        /** Cloudflare Access Client Secret */
        cfAccessClientSecret?: string;
    }
>;

export type GetGheConfigResult =
    | { ok: true; config: GheConfig }
    | {
          ok: false;
          error: "NOT_CONFIGURED" | "EDGE_CONFIG_ERROR" | "INVALID_URL";
      };

/**
 * Normalizes a URL by adding https:// if no protocol is present.
 */
function normalizeUrl(url: string): string {
    const trimmed = url.trim();
    if (!trimmed) {
        return trimmed;
    }
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
        return `https://${trimmed}`;
    }
    return trimmed;
}

/**
 * Extracts the host from a GitHub URL.
 */
function getHostFromUrl(repoUrl: string): string | null {
    try {
        const url = new URL(normalizeUrl(repoUrl));
        return url.host;
    } catch {
        return null;
    }
}

/**
 * Gets the GitHub Enterprise configuration for a given repo URL.
 * Checks edge config keyed by the host of the repo URL.
 *
 * @param repoUrl - The full repo URL (e.g., "https://github.mycompany.com/org/repo")
 * @returns The GHE config if found, or an error result
 */
export async function getGheConfig(repoUrl: string): Promise<GetGheConfigResult> {
    try {
        const host = getHostFromUrl(repoUrl);
        if (!host) {
            return { ok: false, error: "INVALID_URL" };
        }

        // Check edge config keyed by host
        const config = await getEdge<GheConfigStructure>(GITHUB_ENTERPRISE_CONFIG_EDGE_KEY);

        if (config && typeof config === "object" && config[host]) {
            const hostConfig = config[host];

            const baseUrl = `https://${host}`;
            return {
                ok: true,
                config: {
                    appId: hostConfig.appId,
                    privateKeyBase64: hostConfig.privateKeyBase64,
                    organization: hostConfig.organization,
                    baseUrl,
                    proxyUrl: hostConfig.proxyUrl ?? baseUrl,
                    cfAccessClientId: hostConfig.cfAccessClientId,
                    cfAccessClientSecret: hostConfig.cfAccessClientSecret
                }
            };
        }

        return { ok: false, error: "NOT_CONFIGURED" };
    } catch {
        return { ok: false, error: "EDGE_CONFIG_ERROR" };
    }
}

/**
 * Checks if a GitHub URL is for a GitHub Enterprise instance based on edge config.
 *
 * @param githubUrl - The GitHub URL to check
 * @returns true if this is a GHE URL that we have config for
 */
export async function isGheUrl(githubUrl: string): Promise<boolean> {
    try {
        const host = getHostFromUrl(githubUrl);

        if (!host) {
            return false;
        }

        // github.com is never GHE
        if (host === "github.com" || host === "www.github.com") {
            return false;
        }

        // Check edge config for this host
        const config = await getEdge<GheConfigStructure>(GITHUB_ENTERPRISE_CONFIG_EDGE_KEY);

        if (config && typeof config === "object" && config[host]) {
            return true;
        }

        return false;
    } catch {
        return false;
    }
}
