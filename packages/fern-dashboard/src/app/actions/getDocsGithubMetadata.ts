"use server";

import { fernToken_admin } from "@fern-api/docs-server";

import type { GithubAuthState } from "@/components/docs-page/GithubSourceClient";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { DocsUrl } from "@/utils/types";
import { getDocsUrlMetadata } from "../api/utils/getDocsUrlMetadata";
import { type Auth0SessionData, getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import type { Auth0OrgName } from "../services/auth0/types";
import { getDocsGithubUrl } from "../services/dal/github/getDocsGithubUrl";
import { validateGithubRepoAccess } from "../services/dal/github/validators";
import { getGithubSourceMetadata } from "./getGithubSourceMetadata";

async function getMetadata(
    encodedDocsUrl: EncodedDocsUrl,
    session: Auth0SessionData,
    orgName: Auth0OrgName,
    docsUrl: DocsUrl
) {
    let githubAuthState: GithubAuthState = {
        validationResult: {
            ok: false,
            error: {
                type: "UNEXPECTED_ERROR",
                message: "Domain not registered."
            }
        },
        sourceRepo: undefined,
        isLoading: true
    };
    let githubUrl: string | undefined;
    try {
        const urlResult = await getDocsGithubUrl(encodedDocsUrl, session.accessToken);

        if (!urlResult.success) {
            if (urlResult.error.type === "DOMAIN_NOT_REGISTERED") {
                githubAuthState.validationResult = {
                    ok: false,
                    error: {
                        type: "UNEXPECTED_ERROR",
                        message: "Domain not registered."
                    }
                };
            } else {
                githubAuthState.validationResult = {
                    ok: false,
                    error: urlResult.error
                };
            }
            return { success: false, githubAuthState };
        }

        githubUrl = urlResult.githubUrl;

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
            return { success: true, githubAuthState, githubUrl };
        } catch (error) {
            console.error("Failed to validate GitHub access:", error);
            return { success: false, error: "Failed to validate GitHub access" };
        }
    } catch (error) {
        console.error("Failed to get metadata", error);
        return { success: false, error: "Failed to get metadata" };
    }
}

export async function getDocsGithubMetadata(docsUrl: DocsUrl): Promise<{
    success: boolean;
    orgName?: Auth0OrgName;
    githubUrl?: string;
    baseBranch?: string;
    error?: string;
}> {
    try {
        const session = await getCurrentSessionOrThrow();
        const decodedUrl = parseDocsUrlParam({ docsUrl });
        const docsMetadata = await getDocsUrlMetadata({
            url: decodedUrl,
            token: fernToken_admin() ?? session.accessToken
        });
        const githubMetadata = await getDocsGithubUrl(docsUrl, fernToken_admin() ?? session.accessToken);
        if (!githubMetadata.success) {
            return { success: false, error: "Failed to fetch github metadata" };
        }

        if (!docsMetadata.ok || !docsMetadata.body.org) {
            return { success: false, error: "Failed to fetch docs metadata" };
        }

        const orgName = docsMetadata.body.org as unknown as Auth0OrgName;

        const metadata = await getMetadata(docsUrl, session, orgName, decodedUrl);
        if (!metadata?.success) {
            return { success: false, error: "Failed to fetch metadata" };
        }
        return {
            success: true,
            orgName: orgName,
            githubUrl: metadata.githubUrl,
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
