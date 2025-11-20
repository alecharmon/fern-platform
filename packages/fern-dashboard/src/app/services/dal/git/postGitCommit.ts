"use server";

import type { GitAccessError, GitOperationError } from "@fern-api/docs-loader";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getGitLoader } from "@/app/services/github/getGitLoader";
import type { GithubCommitableFile } from "@/app/services/github/types";
import type { Auth0OrgName } from "../../auth0/types";
import { assertUserHasOrganizationAccess } from "../organization";

export type PostGitCommitErrors =
    | GitAccessError
    | GitOperationError
    | { type: "NOT_LOGGED_IN" }
    | { type: "ORG_ACCESS_DENIED"; message: string };

export default async function postGitCommit(request: {
    owner: string;
    repo: string;
    branch: string;
    message: string;
    orgName: Auth0OrgName;
    files: GithubCommitableFile[];
    site: string;
    gitUrl?: string;
}): Promise<
    | {
          success: true;
          commitSha?: string;
      }
    | {
          success: false;
          error: PostGitCommitErrors;
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
        ? getGitLoader(request.gitUrl)
        : getGitLoader(`https://github.com/${request.owner}/${request.repo}`);

    // 4. Validate repository access
    const accessResult = await loader.validateAccess?.({
        owner: request.owner,
        repo: request.repo,
        site: request.site,
        orgName: request.orgName
    });

    if (accessResult?.type === "error") {
        return { success: false, error: accessResult.error };
    }

    // 5. Perform git operation
    const result = await loader.createCommit?.({
        owner: request.owner,
        repo: request.repo,
        branch: request.branch,
        message: request.message,
        files: request.files
    });

    if (!result) {
        return {
            success: false,
            error: { type: "UNKNOWN_ERROR", message: "createCommit method not available on loader" }
        };
    }

    if (result.type === "ok") {
        return { success: true, commitSha: result.commitSha };
    } else {
        return { success: false, error: result.error };
    }
}
