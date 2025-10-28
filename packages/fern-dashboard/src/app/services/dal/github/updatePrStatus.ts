"use server";

import * as Sentry from "@sentry/nextjs";
import { type FernBotOctokitError, getFernBotOctokitForRepo } from "@/app/services/auth0/fernBotOctokit";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { GithubPrStatus } from "@/app/services/github/types";
import { type GithubPrInfo, RedisCacheKey } from "@/app/services/redis/cacheKey";
import { redisDel, redisGet, redisSet } from "@/app/services/redis/redis";
import type { Auth0OrgName } from "../../auth0/types";
import { type AuthError, withGithubAuth } from "./middleware";

const convertToDraftMutation = `mutation ConvertPullRequestToDraft($pullRequestId: ID!) {
  convertPullRequestToDraft(input: { pullRequestId: $pullRequestId }) {
    pullRequest {
      id
      isDraft
    }
  }
}`;

const markPrReadyForReviewMutation = `mutation MarkPullRequestReadyForReview($pullRequestId: ID!) {
  markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
    clientMutationId
  }
}`;

export type UpdatePrStatusErrors =
    | AuthError
    | FernBotOctokitError
    | { type: "NOT_LOGGED_IN" }
    | { type: "FAILED_TO_GET_GITHUB_CLIENT"; message: string }
    | { type: "NO_PR_FOUND"; message: string }
    | { type: "FAILED_TO_UPDATE_PR_STATUS"; message: string }
    | { type: "FAILED_TO_GET_PR_FOR_BRANCH"; message: string }
    | { type: "UNKNOWN_ERROR"; message: string };

/**
 * Updates the status of a PR (open or draft).
 */
export default async function updatePrStatus(request: {
    owner: string;
    repo: string;
    branch: string;
    status: "open" | "draft";
    baseBranch?: string;
    orgName: Auth0OrgName;
    site: string;
}): Promise<
    | {
          success: true;
          status?: GithubPrStatus;
          prNumber?: number;
          prUrl?: string;
      }
    | {
          success: false;
          error: UpdatePrStatusErrors;
      }
> {
    const session = await getCurrentSession();
    if (session == null) {
        return { success: false, error: { type: "NOT_LOGGED_IN" } };
    }

    return withGithubAuth(
        session.user.sub,
        session.accessToken,
        request.orgName,
        {
            owner: request.owner,
            repo: request.repo,
            site: request.site
        },
        async (authResult) => {
            if (!authResult.ok) {
                return { success: false, error: authResult.error };
            }

            const octokitResult = await getFernBotOctokitForRepo(request.owner, request.repo);

            if (!octokitResult.ok) {
                return { success: false, error: octokitResult.error };
            }

            const octokit = octokitResult.octokit;

            try {
                // Get PR for branch - inline to avoid dependency on handler
                const cacheKey = RedisCacheKey.githubPrForBranch(
                    request.owner,
                    request.repo,
                    request.branch,
                    request.baseBranch
                );

                let cachedPrInfo: GithubPrInfo | null = null;

                try {
                    cachedPrInfo = (await redisGet(cacheKey)) ?? null;
                } catch (error) {
                    // If cache fails, continue to fetch from GitHub
                    console.warn("Failed to read PR info from Redis cache", error);
                }

                let prNodeId: string | undefined;
                let prNumber: number | undefined;
                let prUrl: string | undefined;

                if (cachedPrInfo != null && cachedPrInfo.success && cachedPrInfo.nodeId) {
                    prNodeId = cachedPrInfo.nodeId;
                    prNumber = cachedPrInfo.prNumber;
                    prUrl = cachedPrInfo.prUrl;
                } else {
                    // Fetch PR from GitHub
                    try {
                        const response = await octokit.request("GET /repos/{owner}/{repo}/pulls", {
                            owner: request.owner,
                            repo: request.repo,
                            head: `${request.owner}:${request.branch}`,
                            base: request.baseBranch,
                            state: "all"
                        });

                        if (response.data.length === 0) {
                            return {
                                success: false,
                                error: {
                                    type: "NO_PR_FOUND",
                                    message: "No associated PRs found for this branch"
                                }
                            };
                        }

                        const openPrs = response.data.filter((pr) => pr.state === "open");
                        const pr = openPrs[0] || response.data[0];

                        prNodeId = pr?.node_id;
                        prNumber = pr?.number;
                        prUrl = pr?.html_url;

                        // Update cache
                        try {
                            await redisSet(
                                cacheKey,
                                {
                                    success: true,
                                    title: pr?.title,
                                    prNumber,
                                    prUrl,
                                    status: pr?.state,
                                    draft: pr?.draft,
                                    merged: pr?.merged_at != null,
                                    nodeId: prNodeId
                                },
                                { ttlInSeconds: 60 * 5 }
                            );
                        } catch (error) {
                            console.warn("Failed to write PR info to Redis cache", error);
                        }
                    } catch (error) {
                        return {
                            success: false,
                            error: {
                                type: "FAILED_TO_GET_PR_FOR_BRANCH",
                                message: error instanceof Error ? error.message : "Unknown error occurred"
                            }
                        };
                    }
                }

                if (prNodeId == null) {
                    return {
                        success: false,
                        error: {
                            type: "NO_PR_FOUND",
                            message: "No PR found for this branch"
                        }
                    };
                }

                // Update PR status using GraphQL mutations
                try {
                    if (request.status === "open") {
                        await octokit.graphql(markPrReadyForReviewMutation, {
                            pullRequestId: prNodeId
                        });

                        // Invalidate cache after status change
                        try {
                            await redisDel(cacheKey);
                        } catch (error) {
                            console.warn("Failed to invalidate PR cache", error);
                        }

                        return {
                            success: true,
                            status: "open",
                            prNumber,
                            prUrl
                        };
                    }
                    if (request.status === "draft") {
                        await octokit.graphql(convertToDraftMutation, {
                            pullRequestId: prNodeId
                        });

                        // Invalidate cache after status change
                        try {
                            await redisDel(cacheKey);
                        } catch (error) {
                            console.warn("Failed to invalidate PR cache", error);
                        }

                        return {
                            success: true,
                            status: "draft",
                            prNumber,
                            prUrl
                        };
                    }

                    return {
                        success: false,
                        error: {
                            type: "FAILED_TO_UPDATE_PR_STATUS",
                            message: "Unable to convert PR to requested status: " + request.status
                        }
                    };
                } catch (error) {
                    Sentry.captureException(error, {
                        extra: {
                            owner: request.owner,
                            repo: request.repo,
                            branch: request.branch,
                            status: request.status
                        }
                    });
                    return {
                        success: false,
                        error: {
                            type: "FAILED_TO_UPDATE_PR_STATUS",
                            message: error instanceof Error ? error.message : "Unknown error occurred"
                        }
                    };
                }
            } catch (error) {
                console.error("Failed to update PR status", error);
                Sentry.captureException(error);
                return {
                    success: false,
                    error: {
                        type: "UNKNOWN_ERROR",
                        message: error instanceof Error ? error.message : "Unknown error occurred"
                    }
                };
            }
        }
    );
}
