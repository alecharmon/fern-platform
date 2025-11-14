"use server";

import type { GitOperationError, RepositoryFile } from "@fern-api/docs-loader";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getGitLoaderByOwnerRepo } from "@/app/services/github/getGitLoader";

import type { Auth0OrgName } from "../../auth0/types";
import { assertUserHasOrganizationAccess } from "../organization";

export type PostGitRepositoryErrors =
    | GitOperationError
    | { type: "NOT_LOGGED_IN" }
    | { type: "ORG_ACCESS_DENIED"; message: string };

export default async function postGitRepository(request: {
    orgName: Auth0OrgName;
    owner: string;
    repoName: string;
    description?: string;
    isPrivate?: boolean;
    files: RepositoryFile[];
    site: string;
}): Promise<
    | {
          success: true;
          repoUrl: string;
          htmlUrl: string;
      }
    | {
          success: false;
          error: PostGitRepositoryErrors;
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

    // 3. Get GitLoader instance with demo-creation-bot (for repository creation)
    const loader = getGitLoaderByOwnerRepo(request.owner, request.repoName, true);

    // 4. Perform git operation
    const result = await loader.createRepository?.({
        owner: request.owner,
        repoName: request.repoName,
        description: request.description,
        isPrivate: request.isPrivate,
        files: request.files
    });

    if (!result) {
        return {
            success: false,
            error: { type: "UNKNOWN_ERROR", message: "createRepository method not available on loader" }
        };
    }

    if (result.type === "ok") {
        return { success: true, repoUrl: result.repoUrl, htmlUrl: result.htmlUrl };
    } else {
        return { success: false, error: result.error };
    }
}
