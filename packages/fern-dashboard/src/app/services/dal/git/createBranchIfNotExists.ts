"use server";

import type { GitAccessError, GitOperationError } from "@fern-api/docs-loader";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getGitLoader } from "@/app/services/github/getGitLoader";
import type { DocsUrl } from "@/utils/types";

import { assertUserHasOrganizationAccess } from "../organization";

export type CreateBranchErrors =
    | GitAccessError
    | GitOperationError
    | { type: "NOT_LOGGED_IN" }
    | { type: "ORG_ACCESS_DENIED"; message: string };

export default async function createBranchIfNotExists(request: {
    owner: string;
    repo: string;
    branch: string;
    baseBranch: string;
    orgName: Auth0OrgName;
    site: DocsUrl;
    gitUrl?: string; // Optional URL to detect provider
}): Promise<
    | {
          success: true;
          baseSha: string;
          alreadyExists: boolean;
      }
    | {
          success: false;
          error: CreateBranchErrors;
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
    const result = await loader.createBranch?.({
        owner: request.owner,
        repo: request.repo,
        branch: request.branch,
        baseBranch: request.baseBranch
    });

    if (!result) {
        return {
            success: false,
            error: { type: "UNKNOWN_ERROR", message: "createBranch method not available on loader" }
        };
    }

    if (result.type === "ok") {
        return { success: true, baseSha: result.baseSha, alreadyExists: result.alreadyExists };
    } else {
        return { success: false, error: result.error };
    }
}
