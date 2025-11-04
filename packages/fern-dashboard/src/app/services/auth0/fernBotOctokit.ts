import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/core";
import { cache } from "react";
import { RedisCacheKey } from "@/app/services/redis/cacheKey";
import { redisGet, redisSet } from "@/app/services/redis/redis";

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
export async function getFernBotOctokitForOrg(owner: string): Promise<GetFernBotOctokitForRepoResult> {
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
        return { ok: true, octokit };
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
    async (owner: string, repo: string): Promise<GetFernBotOctokitForRepoResult> => {
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
            return { ok: true, octokit };
        } catch (e: any) {
            return {
                ok: false,
                error: { type: "UNKNOWN_ERROR", message: e?.message ?? "Unknown error" }
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

        // Cache the installation ID for 10 days
        try {
            await redisSet(cacheKey, installation.id, { ttlInSeconds: 60 * 60 * 24 * 10 });
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

                // Cache the installation ID for 10 days
                try {
                    await redisSet(cacheKey, installation.id, { ttlInSeconds: 60 * 60 * 24 * 10 });
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

            // Cache the installation ID for 10 days
            try {
                await redisSet(cacheKey, installation.id, { ttlInSeconds: 60 * 60 * 24 * 10 });
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
export function getDemoCreationBotOctokit():
    | { ok: true; octokit: Octokit }
    | { ok: false; error: { type: "MISSING_TOKEN" } } {
    const token = process.env.FERN_DEMO_CREATION_BOT_TOKEN;

    if (!token) {
        console.error("FERN_DEMO_CREATION_BOT_TOKEN environment variable is not set");
        return { ok: false, error: { type: "MISSING_TOKEN" } };
    }

    const octokit = new Octokit({
        auth: token
    });

    return { ok: true, octokit };
}
