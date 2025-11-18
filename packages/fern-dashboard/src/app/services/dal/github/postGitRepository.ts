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
    /**
     * If provided, a FERN_TOKEN will be generated and set as a GitHub Actions secret
     * after the repository is created. This requires a working directory with a Fern project.
     */
    setFernToken?: {
        workingDir: string;
        fernToken?: string;
    };
}): Promise<
    | {
          success: true;
          repoUrl: string;
          htmlUrl: string;
          /**
           * The generated FERN_TOKEN, if setFernToken was provided
           */
          fernToken?: string;
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
        let fernToken: string | undefined;

        // If setFernToken is provided, generate and set the FERN_TOKEN secret
        if (request.setFernToken) {
            const { setFernTokenSecret } = await import("./setFernTokenSecret");

            console.log("Generating and setting FERN_TOKEN for repository...");
            const tokenResult = await setFernTokenSecret({
                owner: request.owner,
                repoName: request.repoName,
                workingDir: request.setFernToken.workingDir,
                fernToken: request.setFernToken.fernToken
            });

            if (tokenResult.success) {
                fernToken = tokenResult.token;
                console.log("✓ FERN_TOKEN generated and set successfully");
            } else {
                console.error("Failed to set FERN_TOKEN:", tokenResult.error);
                // Don't fail the entire operation if token generation fails
                // The repository was still created successfully
            }
        }

        return { success: true, repoUrl: result.repoUrl, htmlUrl: result.htmlUrl, fernToken };
    } else {
        return { success: false, error: result.error };
    }
}
