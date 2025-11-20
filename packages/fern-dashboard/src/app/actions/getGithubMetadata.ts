import "server-only";
import { cache } from "react";
import type { GithubAuthState } from "@/components/docs-page/GithubSourceClient";
import type { DocsUrl } from "@/utils/types";
import type { Auth0SessionData } from "../services/auth0/getCurrentSession";
import type { Auth0OrgName } from "../services/auth0/types";
import { type GetDocsGithubUrlResult, getDocsGitUrl } from "../services/dal/git/getDocsGitUrl";
import { validateRepoAccess } from "../services/dal/git/validators";
import { parseGitUrl } from "../services/git-common/url-utils";
import { getGithubSourceMetadata } from "./getGithubSourceMetadata";
import { getGitlabSourceMetadata } from "./getGitlabSourceMetadata";

type GetDocsGithubUrlError = Extract<GetDocsGithubUrlResult, { success: false }>["error"];

export type GetGitHubAuthStateResult = GithubAuthState | { success: false; error: GetDocsGithubUrlError };

export const getGitHubAuthState = cache(
    async (
        docsUrl: DocsUrl,
        token: string,
        orgName: Auth0OrgName,
        session: Auth0SessionData
    ): Promise<GetGitHubAuthStateResult> => {
        const urlResult = await getDocsGitUrl(docsUrl, token);

        if (!urlResult.success) {
            return { success: false, error: urlResult.error };
        }

        const gitUrl = urlResult.gitUrl;
        let githubAuthState: GithubAuthState = {
            validationResult: {
                ok: false,
                error: {
                    type: "UNEXPECTED_ERROR",
                    message: ""
                }
            },
            sourceRepo: undefined,
            isLoading: false
        };

        try {
            // Determine provider to fetch appropriate metadata
            const parsed = parseGitUrl(gitUrl);
            const isGitLab = parsed.provider === "gitlab";

            // Parallelize validation and metadata fetching for better performance
            const [validation, sourceRepo] = await Promise.all([
                validateRepoAccess(orgName, docsUrl, gitUrl),
                // Fetch metadata based on provider
                isGitLab
                    ? getGitlabSourceMetadata({
                          gitlabUrl: gitUrl,
                          userId: session.user.sub
                      }).catch((error) => {
                          console.error("Failed to fetch GitLab source repo metadata:", error);
                          return undefined;
                      })
                    : getGithubSourceMetadata({
                          gitUrl,
                          userId: session.user.sub
                      }).catch((error) => {
                          console.error("Failed to fetch GitHub source repo metadata:", error);
                          return undefined;
                      })
            ]);

            githubAuthState = {
                validationResult: validation,
                // Only include sourceRepo if validation succeeded
                sourceRepo: validation.ok ? sourceRepo : undefined,
                isLoading: false
            };
        } catch (error) {
            console.error("Failed to validate GitHub access:", error);
            // Keep default false state
        }

        return githubAuthState;
    }
);
