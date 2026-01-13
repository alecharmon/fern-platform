"use server";

import { fernToken_admin } from "@fern-api/docs-server";

import type { GitAuthState } from "@/components/docs-page/GitSourceClient";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { DocsUrl } from "@/utils/types";

import { getDocsUrlMetadata } from "../api/utils/getDocsUrlMetadata";
import { type Auth0SessionData, getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import type { Auth0OrgName } from "../services/auth0/types";
import { validateGitRepoAccess } from "../services/dal/git/validateGitRepoAccess";
import { getDocsGitUrl } from "../services/dal/github/getDocsGitUrl";
import { getGithubSourceMetadata } from "./getGithubSourceMetadata";

async function getMetadata(session: Auth0SessionData, orgName: Auth0OrgName, docsUrl: DocsUrl) {
    let githubAuthState: GitAuthState = {
        validationResult: {
            ok: false,
            provider: "unknown",
            error: {
                type: "UNEXPECTED_ERROR",
                message: "Domain not registered."
            }
        },
        sourceRepo: undefined,
        isLoading: true
    };
    let gitUrl: string | undefined;
    try {
        const urlResult = await getDocsGitUrl(docsUrl, session.accessToken);

        if (!urlResult.success) {
            if (urlResult.error.type === "DOMAIN_NOT_REGISTERED") {
                githubAuthState.validationResult = {
                    ok: false,
                    provider: "unknown",
                    error: {
                        type: "UNEXPECTED_ERROR",
                        message: "Domain not registered."
                    }
                };
            } else {
                githubAuthState.validationResult = {
                    ok: false,
                    provider: "unknown",
                    error: urlResult.error
                };
            }
            return { success: false, githubAuthState };
        }

        gitUrl = urlResult.gitUrl;

        try {
            // Parallelize validation and metadata fetching for better performance
            const [validation, sourceRepo] = await Promise.all([
                validateGitRepoAccess(orgName, docsUrl, gitUrl),
                // Optimistically fetch metadata in parallel (will be used if validation succeeds)
                getGithubSourceMetadata({
                    githubUrl: gitUrl,
                    userId: session.user.sub
                }).catch((error: unknown) => {
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
            return { success: true, githubAuthState, gitUrl };
        } catch (error) {
            console.error("Failed to validate GitHub access:", error);
            return { success: false, error: "Failed to validate GitHub access" };
        }
    } catch (error) {
        console.error("Failed to get metadata", error);
        return { success: false, error: "Failed to get metadata" };
    }
}

export async function getDocsGithubMetadata(docsUrl: DocsUrl): Promise<
    | {
          success: true;
          orgName: Auth0OrgName;
          githubUrl?: string;
          baseBranch?: string;
      }
    | {
          success: false;
          error: string;
      }
> {
    try {
        const session = await getCurrentSessionOrThrow();
        const decodedUrl = parseDocsUrlParam({ docsUrl });
        const docsMetadata = await getDocsUrlMetadata({
            url: decodedUrl,
            token: fernToken_admin() ?? session.accessToken
        });
        const githubMetadata = await getDocsGitUrl(docsUrl, fernToken_admin() ?? session.accessToken);
        if (!githubMetadata.success) {
            return { success: false, error: "Failed to fetch github metadata" };
        }

        if (!docsMetadata.ok || !docsMetadata.body.org) {
            return { success: false, error: "Failed to fetch docs metadata" };
        }

        const orgName = docsMetadata.body.org as unknown as Auth0OrgName;

        const metadata = await getMetadata(session, orgName, docsUrl);
        if (!metadata?.success) {
            return { success: false, error: "Failed to fetch metadata" };
        }
        return {
            success: true,
            orgName: orgName,
            githubUrl: githubMetadata.gitUrl,
            baseBranch: metadata.githubAuthState?.sourceRepo?.baseBranch ?? undefined
        };
    } catch (error) {
        console.error("Failed to get docs GitHub metadata", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error occurred"
        };
    }
}
