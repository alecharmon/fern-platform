"use server";

import type { GitAccessError, GitOperationError } from "@fern-api/docs-loader";
import * as Sentry from "@sentry/nextjs";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getGitLoader } from "@/app/services/github/getGitLoader";
import type { GithubPrStatus } from "@/app/services/github/types";
import { RedisCacheKey } from "@/app/services/redis/cacheKey";
import { redisDel } from "@/app/services/redis/redis";

import type { Auth0OrgName } from "../../auth0/types";
import { assertUserHasOrganizationAccess } from "../organization";

export type UpdatePrStatusErrors =
    | GitAccessError
    | GitOperationError
    | { type: "NOT_LOGGED_IN" }
    | { type: "ORG_ACCESS_DENIED"; message: string };

export type UpdatePrStatusRequest = {
    owner: string;
    repo: string;
    branch: string;
    status: "open" | "draft";
    baseBranch?: string;
    orgName: Auth0OrgName;
    site: string;
    gitUrl?: string;
};

/**
 * Updates the status of a PR/MR (open or draft).
 */
export default async function updatePrStatus(request: UpdatePrStatusRequest): Promise<
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
    // 1. Check user session
    const session = await getCurrentSession();
    if (session == null) {
        return { success: false, error: { type: "NOT_LOGGED_IN" } };
    }

    // 2. Check org membership
    try {
        await assertUserHasOrganizationAccess(session.accessToken, request.orgName);
    } catch (error) {
        return {
            success: false,
            error: {
                type: "ORG_ACCESS_DENIED",
                message: error instanceof Error ? error.message : "User is not a member of the organization"
            }
        };
    }

    // 3. Get GitLoader instance
    const loader = request.gitUrl
        ? await getGitLoader(request.gitUrl)
        : await getGitLoader(`https://github.com/${request.owner}/${request.repo}`);

    // 4. Validate repository access
    const accessResult = await loader.validateAccess({
        owner: request.owner,
        repo: request.repo,
        site: request.site,
        orgName: request.orgName
    });

    if (accessResult?.type === "error") {
        return { success: false, error: accessResult.error };
    }

    // 5. Update PR status
    try {
        const result = await loader.updatePullRequestStatus?.({
            owner: request.owner,
            repo: request.repo,
            branch: request.branch,
            status: request.status,
            baseBranch: request.baseBranch
        });

        if (!result) {
            return {
                success: false,
                error: {
                    type: "UNKNOWN_ERROR",
                    message: "updatePullRequestStatus method not available on loader"
                }
            };
        }

        if (result.type === "ok") {
            // Invalidate cache after status change
            const cacheKey = RedisCacheKey.githubPrForBranch(
                request.owner,
                request.repo,
                request.branch,
                request.baseBranch
            );

            try {
                await redisDel(cacheKey);
            } catch (error) {
                console.warn("Failed to invalidate PR cache", error);
            }

            return {
                success: true,
                status: result.status,
                prNumber: result.prNumber,
                prUrl: result.prUrl
            };
        } else {
            return { success: false, error: result.error };
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
