"use server";

import { cache } from "react";
import { getFernBotOctokitForRepo } from "@/app/services/auth0/fernBotOctokit";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { RedisCacheKey } from "@/app/services/redis/cacheKey";
import { redisGet, redisSet } from "@/app/services/redis/redis";
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

export const getPrForBranch = cache(
    async (
        orgName: Auth0OrgName,
        owner: string,
        repo: string,
        branch: string,
        baseBranch?: string
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
            // If cache fails, continue to fetch from GitHub
            console.warn("Failed to read PR info from Redis cache", error);
        }

        const octokitResult = await getFernBotOctokitForRepo(owner, repo);

        if (!octokitResult.ok) {
            throw new Error(`Failed to get GitHub client: ${octokitResult.error.type}`);
        }

        const octokit = octokitResult.octokit;

        try {
            // Find associated PRs for the branch
            const response = await octokit.request("GET /repos/{owner}/{repo}/pulls", {
                owner,
                repo,
                head: `${owner}:${branch}`,
                base: baseBranch,
                state: "all" // we fetch all so that we are able to display the status if its not open
            });

            if (response.data.length === 0) {
                return {
                    success: false,
                    error: "No associated PRs found for this branch"
                };
            }

            const openPrs = response.data.filter((pr) => pr.state === "open");

            if (openPrs.length > 1) {
                return {
                    success: false,
                    error: "Multiple open PRs found for this branch"
                };
            }

            // Use the open PR if it exists, otherwise use the first PR returned.
            // The UI will handle the case where the PR is closed/merged, but we should error (above)
            // if there are multiple open PRs.
            const pr = openPrs[0] || response.data[0];
            const result = {
                success: true,
                title: pr?.title,
                prNumber: pr?.number,
                prUrl: pr?.html_url,
                status: pr?.state,
                draft: pr?.draft,
                merged: pr?.merged_at != null,
                nodeId: pr?.node_id
            };

            // Cache the result for 5 minutes
            try {
                await redisSet(cacheKey, result, { ttlInSeconds: 60 * 5 });
            } catch (error) {
                // If cache fails, continue - we still have the result
                console.warn("Failed to write PR info to Redis cache", error);
            }

            return result as GetPrForBranchSuccess;
        } catch (error) {
            console.error("Failed to fetch PR for branch", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error occurred"
            };
        }
    }
);
