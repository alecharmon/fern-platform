import "server-only";
import { cache } from "react";
import type { GithubAuthState } from "@/components/docs-page/GithubSourceClient";
import type { DocsUrl } from "@/utils/types";
import type { Auth0SessionData } from "../services/auth0/getCurrentSession";
import type { Auth0OrgName } from "../services/auth0/types";
import { type GetDocsGithubUrlResult, getDocsGithubUrl } from "../services/dal/github/getDocsGithubUrl";
import { validateGithubRepoAccess } from "../services/dal/github/validators";
import { getGithubSourceMetadata } from "./getGithubSourceMetadata";

type GetDocsGithubUrlError = Extract<GetDocsGithubUrlResult, { success: false }>["error"];

export type GetGitHubAuthStateResult =
    | ({ success: true } & GithubAuthState)
    | { success: false; error: GetDocsGithubUrlError };

export const getGitHubAuthState = cache(
    async (
        docsUrl: DocsUrl,
        token: string,
        orgName: Auth0OrgName,
        session: Auth0SessionData
    ): Promise<GetGitHubAuthStateResult> => {
        const urlResult = await getDocsGithubUrl(docsUrl, token);
        if (!urlResult.success) {
            return { success: false, error: urlResult.error };
        }

        const githubUrl = urlResult.githubUrl;
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
            // Parallelize validation and metadata fetching for better performance
            const [validation, sourceRepo] = await Promise.all([
                validateGithubRepoAccess(
                    orgName,
                    docsUrl,
                    {
                        type: "url",
                        githubUrl
                    },
                    true // Skip cache for now, since this cache was causing issues with validating repos
                ),
                // Optimistically fetch metadata in parallel (will be used if validation succeeds)
                getGithubSourceMetadata({
                    githubUrl,
                    userId: session.user.sub
                }).catch((error) => {
                    console.error("Failed to fetch source repo metadata:", error);
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

        return { success: true, ...githubAuthState };
    }
);
