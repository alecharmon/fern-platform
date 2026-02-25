"use server";

import { cache } from "react";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getGitLoader } from "@/app/services/github/getGitLoader";
import { RedisCacheKey } from "@/app/services/redis/cacheKey";
import { redisDel, redisGet, redisSet } from "@/app/services/redis/redis";

import type { Auth0OrgName } from "../../auth0/types";
import { assertUserHasOrganizationAccess } from "../organization";

type GetPrForBranchSuccess = {
    success: true;
    title?: string;
    prNumber?: number;
    prUrl?: string;
    status?: string;
    draft?: boolean;
    merged?: boolean;
    nodeId?: string;
};

type GetPrForBranchError = {
    success: false;
    error: string;
};

export type GetPrForBranchResult = GetPrForBranchSuccess | GetPrForBranchError;

/**
 * Fetches fresh PR data for a branch, bypassing the Redis cache.
 * Use this when you need the latest PR status (e.g., after a visibility change).
 * Invalidates the stale cache entry before fetching, and updates it with fresh data.
 */
export async function refreshPrForBranch(
    orgName: Auth0OrgName,
    owner: string,
    repo: string,
    branch: string,
    baseBranch?: string,
    repoUrl?: string
): Promise<GetPrForBranchResult> {
    // Invalidate the Redis cache so we get fresh data
    const cacheKey = RedisCacheKey.githubPrForBranch(owner, repo, branch, baseBranch);
    try {
        await redisDel(cacheKey);
    } catch (error) {
        console.warn("Failed to invalidate PR cache in Redis", error);
    }

    // Delegate to the main function which will now miss the cache and fetch fresh data
    return getPrForBranch(orgName, owner, repo, branch, baseBranch, repoUrl);
}

export const getPrForBranch = cache(
    async (
        orgName: Auth0OrgName,
        owner: string,
        repo: string,
        branch: string,
        baseBranch?: string,
        repoUrl?: string
    ): Promise<GetPrForBranchResult> => {
        const session = await getCurrentSession();
        if (session == null) {
            return { success: false, error: "No session found" };
        }

        try {
            await assertUserHasOrganizationAccess(session.accessToken, orgName);
        } catch (_error) {
            return {
                success: false,
                error: `User is not a member of the specified organization: ${orgName}`
            };
        }

        // Check cache first
        const cacheKey = RedisCacheKey.githubPrForBranch(owner, repo, branch, baseBranch);
        try {
            const cachedPrInfo = await redisGet(cacheKey);
            if (cachedPrInfo != null) {
                return cachedPrInfo as GetPrForBranchSuccess;
            }
        } catch (error) {
            // If cache fails, continue to fetch
            console.warn("Failed to read PR info from Redis cache", error);
        }

        // Use GitLoader to get PR/MR info
        const url = repoUrl || `https://github.com/${owner}/${repo}`;
        const loader = await getGitLoader(url);

        // Call the loader's getPullRequest method if it exists
        if (typeof (loader as any).getPullRequestForBranch === "function") {
            try {
                const result = await (loader as any).getPullRequestForBranch({
                    owner,
                    repo,
                    branch,
                    baseBranch
                });

                if (result.type === "ok") {
                    const prResult = {
                        success: true,
                        title: result.title,
                        prNumber: result.prNumber,
                        prUrl: result.prUrl,
                        status: result.status,
                        draft: result.draft,
                        merged: result.merged,
                        nodeId: result.nodeId
                    };

                    // Cache the result for 5 minutes
                    try {
                        await redisSet(cacheKey, prResult, { ttlInSeconds: 60 * 5 });
                    } catch (error) {
                        console.warn("Failed to write PR info to Redis cache", error);
                    }

                    return prResult as GetPrForBranchSuccess;
                } else {
                    return {
                        success: false,
                        error: result.error
                    };
                }
            } catch (error) {
                console.error("Failed to fetch PR/MR for branch", error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error occurred"
                };
            }
        }

        // Fallback: Return not available
        return {
            success: false,
            error: "PR information not available for this repository"
        };
    }
);
