import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/core";
import { createSign } from "crypto";
import { cache } from "react";

import { getGheConfig } from "@/app/services/github/ghe-config";
import { instrumentOctokitRateLimits } from "@/app/services/github/github-rate-limit-metrics";
import { withRequestTracking } from "@/app/services/github/trackGithubRequest";
import { RedisCacheKey } from "@/app/services/redis/cacheKey";
import { redisGet, redisSet } from "@/app/services/redis/redis";

/**
 * Generate a JWT for GitHub App authentication.
 * This matches the bash script implementation using RS256 signing.
 */
function generateGitHubAppJwt(appId: string, privateKey: string): string {
    const now = Math.floor(Date.now() / 1000);
    const iat = now - 60; // issued 60 seconds ago to account for clock drift
    const exp = now + 600; // expires in 10 minutes

    const header = { alg: "RS256", typ: "JWT" };
    const payload = { iat, exp, iss: appId };

    const base64UrlEncode = (obj: object): string => {
        return Buffer.from(JSON.stringify(obj))
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
    };

    const headerB64 = base64UrlEncode(header);
    const payloadB64 = base64UrlEncode(payload);
    const unsigned = `${headerB64}.${payloadB64}`;

    const sign = createSign("RSA-SHA256");
    sign.update(unsigned);
    const signature = sign.sign(privateKey, "base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    return `${unsigned}.${signature}`;
}

export type FernBotOctokitError =
    | { type: "MISSING_APP_ID" }
    | { type: "MISSING_PRIVATE_KEY" }
    | { type: "NOT_INSTALLED"; owner: string; repo: string }
    | { type: "UNKNOWN_ERROR"; message: string };

export type GetFernBotOctokitForRepoResult = { ok: true; octokit: Octokit } | { ok: false; error: FernBotOctokitError };

export type GetFernBotInstallationIdResult =
    | { ok: true; installationId: number }
    | { ok: false; error: FernBotOctokitError };

/**
 * Gets Octokit for an organization where fern-bot is installed.
 * Used when creating new repositories.
 *
 * @param owner - The owner (org or user) of the installation
 * @returns A discriminated union result with the Octokit instance or an error
 */
export async function getFernBotOctokitForOrg(owner: string, caller: string): Promise<GetFernBotOctokitForRepoResult> {
    const appId = process.env.FERN_BOT_APP_ID;
    const privateKey = process.env.FERN_BOT_PRIVATE_KEY;

    if (!appId) {
        return { ok: false, error: { type: "MISSING_APP_ID" } };
    }
    if (!privateKey) {
        return { ok: false, error: { type: "MISSING_PRIVATE_KEY" } };
    }

    const installationIdResult = await getFernBotInstallationIdForOrg(owner);
    if (!installationIdResult.ok) {
        return { ok: false, error: installationIdResult.error };
    }

    try {
        const octokit = new Octokit({
            authStrategy: createAppAuth,
            auth: {
                appId,
                privateKey: formatPrivateKey(privateKey),
                installationId: installationIdResult.installationId
            }
        });
        instrumentOctokitRateLimits(octokit, "fern-bot", caller);
        return { ok: true, octokit: withRequestTracking(octokit) };
    } catch (e: any) {
        return {
            ok: false,
            error: { type: "UNKNOWN_ERROR", message: e?.message ?? "Unknown error" }
        };
    }
}

/**
 * Gets Octokit for a specific repo where fern-bot is installed. This should then
 * deprecate the use of the `octokit.ts` file.
 *
 * @param owner - The owner of the repository
 * @param repo - The name of the repository
 * @returns A discriminated union result with the Octokit instance or an error
 */
export const getFernBotOctokitForRepo = cache(
    async (owner: string, repo: string, caller: string): Promise<GetFernBotOctokitForRepoResult> => {
        const appId = process.env.FERN_BOT_APP_ID;
        const privateKey = process.env.FERN_BOT_PRIVATE_KEY;

        if (!appId) {
            return { ok: false, error: { type: "MISSING_APP_ID" } };
        }
        if (!privateKey) {
            return { ok: false, error: { type: "MISSING_PRIVATE_KEY" } };
        }

        const installationIdResult = await getFernBotInstallationId(owner, repo);
        if (!installationIdResult.ok) {
            return { ok: false, error: installationIdResult.error };
        }

        try {
            const octokit = new Octokit({
                authStrategy: createAppAuth,
                auth: {
                    appId,
                    privateKey: formatPrivateKey(privateKey),
                    installationId: installationIdResult.installationId
                }
            });
            instrumentOctokitRateLimits(octokit, "fern-bot", caller);
            return { ok: true, octokit: withRequestTracking(octokit) };
        } catch (e: any) {
            return {
                ok: false,
                error: {
                    type: "UNKNOWN_ERROR",
                    message: e?.message ?? "Unknown error"
                }
            };
        }
    }
);

/**
 * Gets the installation id for the fern-bot for a given organization/user.
 * Used when creating new repositories.
 *
 * @param owner - The owner (org or user) of the installation
 * @returns A discriminated union result with the installation id or an error
 */
export async function getFernBotInstallationIdForOrg(owner: string): Promise<GetFernBotInstallationIdResult> {
    // Try to get from cache first
    const cacheKey = RedisCacheKey.githubInstallationId(owner, "__org__");
    try {
        const cachedInstallationId = await redisGet(cacheKey);
        if (cachedInstallationId != null) {
            return { ok: true, installationId: cachedInstallationId };
        }
    } catch (error) {
        // If cache fails, continue to fetch from GitHub
        console.warn("Failed to read from Redis cache for org installation ID", error);
    }

    const appId = process.env.FERN_BOT_APP_ID;
    const privateKeyEnv = process.env.FERN_BOT_PRIVATE_KEY;

    if (!appId) {
        return { ok: false, error: { type: "MISSING_APP_ID" } };
    }
    if (!privateKeyEnv) {
        return { ok: false, error: { type: "MISSING_PRIVATE_KEY" } };
    }

    const privateKey = formatPrivateKey(privateKeyEnv);

    const appOctokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
            appId,
            privateKey
        }
    });

    try {
        // Try to get installation for organization
        const response = await appOctokit.request("GET /orgs/{org}/installation", {
            org: owner
        });
        const installation = response.data;

        // Cache the installation ID for 1 day
        try {
            await redisSet(cacheKey, installation.id, { ttlInSeconds: 60 * 60 * 24 });
        } catch (error) {
            // If cache fails, continue - we still have the installation ID
            console.warn("Failed to write to Redis cache for org installation ID", error);
        }

        return { ok: true, installationId: installation.id };
    } catch (error: any) {
        if (error?.status === 404) {
            // If not found as org, try as user
            try {
                const response = await appOctokit.request("GET /users/{username}/installation", {
                    username: owner
                });
                const installation = response.data;

                // Cache the installation ID for 1 day
                try {
                    await redisSet(cacheKey, installation.id, {
                        ttlInSeconds: 60 * 60 * 24
                    });
                } catch (error) {
                    console.warn("Failed to write to Redis cache for user installation ID", error);
                }

                return { ok: true, installationId: installation.id };
            } catch (userError: any) {
                if (userError?.status === 404) {
                    // fern-bot is not installed for this org/user
                    return {
                        ok: false,
                        error: { type: "NOT_INSTALLED", owner, repo: "__org__" }
                    };
                }
                return {
                    ok: false,
                    error: {
                        type: "UNKNOWN_ERROR",
                        message: userError?.message ?? "Unknown error"
                    }
                };
            }
        } else {
            return {
                ok: false,
                error: {
                    type: "UNKNOWN_ERROR",
                    message: error?.message ?? "Unknown error"
                }
            };
        }
    }
}

/**
 * Gets the installation id for the fern-bot for a given owner and repo
 * or returns an error result if it does not exist or on failure.
 *
 * @param owner - The owner of the repository
 * @param repo - The name of the repository
 * @returns A discriminated union result with the installation id or an error
 */
export const getFernBotInstallationId = cache(
    async (owner: string, repo: string): Promise<GetFernBotInstallationIdResult> => {
        // Try to get from cache first
        const cacheKey = RedisCacheKey.githubInstallationId(owner, repo);
        try {
            const cachedInstallationId = await redisGet(cacheKey);
            if (cachedInstallationId != null) {
                return { ok: true, installationId: cachedInstallationId };
            }
        } catch (error) {
            // If cache fails, continue to fetch from GitHub
            console.warn("Failed to read from Redis cache for installation ID", error);
        }

        const appId = process.env.FERN_BOT_APP_ID;
        const privateKeyEnv = process.env.FERN_BOT_PRIVATE_KEY;

        if (!appId) {
            return { ok: false, error: { type: "MISSING_APP_ID" } };
        }
        if (!privateKeyEnv) {
            return { ok: false, error: { type: "MISSING_PRIVATE_KEY" } };
        }

        const privateKey = formatPrivateKey(privateKeyEnv);

        const appOctokit = new Octokit({
            authStrategy: createAppAuth,
            auth: {
                appId,
                privateKey
            }
        });

        try {
            const response = await appOctokit.request("GET /repos/{owner}/{repo}/installation", {
                owner,
                repo
            });
            const installation = response.data;

            // Cache the installation ID for 1 day
            try {
                await redisSet(cacheKey, installation.id, {
                    ttlInSeconds: 60 * 60 * 24
                });
            } catch (error) {
                // If cache fails, continue - we still have the installation ID
                console.warn("Failed to write to Redis cache for installation ID", error);
            }

            return { ok: true, installationId: installation.id };
        } catch (error: any) {
            if (error?.status === 404) {
                // fern-bot is not yet installed on that repo
                return {
                    ok: false,
                    error: { type: "NOT_INSTALLED", owner, repo }
                };
            } else {
                return {
                    ok: false,
                    error: {
                        type: "UNKNOWN_ERROR",
                        message: error?.message ?? "Unknown error"
                    }
                };
            }
        }
    }
);

function formatPrivateKey(privateKey: string) {
    // Convert any escaped newlines to actual newlines
    const formattedPrivateKey = privateKey
        .replace(/\\n/g, "\n")
        .replace(/-----BEGIN PRIVATE KEY-----/, "-----BEGIN PRIVATE KEY-----\n")
        .replace(/-----END PRIVATE KEY-----/, "\n-----END PRIVATE KEY-----")
        .trim();

    return formattedPrivateKey;
}

/**
 * Gets an Octokit instance authenticated with the demo creation bot personal access token.
 * This is used for creating demo repositories during onboarding.
 *
 * The demo creation bot is a GitHub user with a personal access token (PAT) that has
 * permissions to create repositories in the target organization.
 *
 * @returns Octokit instance or error
 */
export function getDemoCreationBotOctokit(
    caller: string
): { ok: true; octokit: Octokit } | { ok: false; error: { type: "MISSING_TOKEN" } } {
    const token = process.env.FERN_DEMO_CREATION_BOT_TOKEN;

    if (!token) {
        console.error("FERN_DEMO_CREATION_BOT_TOKEN environment variable is not set");
        return { ok: false, error: { type: "MISSING_TOKEN" } };
    }

    const octokit = new Octokit({
        auth: token
    });
    instrumentOctokitRateLimits(octokit, "demo-bot", caller);

    return { ok: true, octokit: withRequestTracking(octokit) };
}

export type GheOctokitError =
    | { type: "NOT_CONFIGURED" }
    | { type: "ORG_MISMATCH" }
    | { type: "EDGE_CONFIG_ERROR" }
    | { type: "INVALID_URL" }
    | { type: "NO_INSTALLATION" }
    | { type: "UNKNOWN_ERROR"; message: string };

export type GetGheOctokitResult = { ok: true; octokit: Octokit } | { ok: false; error: GheOctokitError };

interface GheApiContext {
    apiBaseUrl: string;
    headers: Record<string, string>;
}

/**
 * Fetches the installation ID for a GitHub App on a specific repo.
 */
async function getGheInstallationId(
    ctx: GheApiContext,
    owner: string,
    repo: string
): Promise<{ ok: true; installationId: number } | { ok: false; error: GheOctokitError }> {
    const url = `${ctx.apiBaseUrl}/repos/${owner}/${repo}/installation`;
    const response = await fetch(url, {
        method: "GET",
        headers: ctx.headers
    });

    if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 404) {
            return { ok: false, error: { type: "NO_INSTALLATION" } };
        }
        return {
            ok: false,
            error: {
                type: "UNKNOWN_ERROR",
                message: `Failed to get installation: ${response.status} ${errorText}`
            }
        };
    }

    const data = await response.json();
    return { ok: true, installationId: data.id };
}

/**
 * Exchanges a JWT for an installation access token.
 */
async function getGheInstallationToken(
    ctx: GheApiContext,
    installationId: number
): Promise<{ ok: true; token: string } | { ok: false; error: GheOctokitError }> {
    const url = `${ctx.apiBaseUrl}/app/installations/${installationId}/access_tokens`;
    const response = await fetch(url, {
        method: "POST",
        headers: ctx.headers
    });

    if (!response.ok) {
        const errorText = await response.text();
        return {
            ok: false,
            error: {
                type: "UNKNOWN_ERROR",
                message: `Failed to get installation token: ${response.status} ${errorText}`
            }
        };
    }

    const data = await response.json();
    return { ok: true, token: data.token };
}

/**
 * Creates an Octokit instance with CF Access headers injected into every request.
 */
function createGheOctokit(
    apiBaseUrl: string,
    token: string,
    cfHeaders: Record<string, string>,
    caller: string
): Octokit {
    const octokit = new Octokit({
        baseUrl: apiBaseUrl,
        auth: token
    });

    // Use hook to inject CF Access headers into every request
    octokit.hook.before("request", async (options) => {
        for (const [key, value] of Object.entries(cfHeaders)) {
            options.headers[key] = value;
        }
    });

    instrumentOctokitRateLimits(octokit, "ghe", caller);

    return octokit;
}

/**
 * Gets an Octokit instance authenticated with a GitHub Enterprise App.
 * This is used for accessing repositories on GitHub Enterprise instances.
 *
 * The GHE App credentials are retrieved from edge config or environment variables,
 * keyed by the host of the repo URL.
 *
 * @param repoUrl - The full repo URL (e.g., "https://github.mycompany.com/org/repo")
 * @param owner - The owner (organization) of the repository
 * @param repo - The name of the repository
 * @returns Octokit instance or error
 */
export const getGheOctokitForRepo = cache(
    async (repoUrl: string, owner: string, repo: string, caller: string): Promise<GetGheOctokitResult> => {
        const configResult = await getGheConfig(repoUrl);
        if (!configResult.ok) {
            return { ok: false, error: { type: configResult.error } };
        }

        const { config } = configResult;

        // Decode the base64-encoded private key
        let privateKey: string;
        try {
            privateKey = Buffer.from(config.privateKeyBase64, "base64").toString("utf-8");
        } catch {
            return {
                ok: false,
                error: {
                    type: "UNKNOWN_ERROR",
                    message: "Failed to decode private key"
                }
            };
        }

        const formattedPrivateKey = formatPrivateKey(privateKey);

        // Construct the API base URL using the proxy URL (for CF tunnel support)
        const apiBaseUrl = config.proxyUrl.endsWith("/api/v3")
            ? config.proxyUrl
            : `${config.proxyUrl.replace(/\/$/, "")}/api/v3`;

        // Build CF Access headers if configured
        const cfHeaders: Record<string, string> = {};
        if (config.cfAccessClientId && config.cfAccessClientSecret) {
            cfHeaders["CF-Access-Client-Id"] = config.cfAccessClientId;
            cfHeaders["CF-Access-Client-Secret"] = config.cfAccessClientSecret;
        }

        try {
            // Generate JWT for GitHub App authentication
            const jwtToken = generateGitHubAppJwt(config.appId, formattedPrivateKey);

            // Create API context with JWT auth headers
            const ctx: GheApiContext = {
                apiBaseUrl,
                headers: {
                    ...cfHeaders,
                    Authorization: `Bearer ${jwtToken}`,
                    Accept: "application/vnd.github+json"
                }
            };

            // Get installation ID for the repo
            const installationResult = await getGheInstallationId(ctx, owner, repo);
            if (!installationResult.ok) {
                return installationResult;
            }

            // Exchange JWT for installation access token
            const tokenResult = await getGheInstallationToken(ctx, installationResult.installationId);
            if (!tokenResult.ok) {
                return tokenResult;
            }

            // Create Octokit with installation token and CF headers
            const octokit = createGheOctokit(apiBaseUrl, tokenResult.token, cfHeaders, caller);
            return { ok: true, octokit: withRequestTracking(octokit) };
        } catch (error: any) {
            return {
                ok: false,
                error: {
                    type: "UNKNOWN_ERROR",
                    message: error?.message ?? "Unknown error"
                }
            };
        }
    }
);
