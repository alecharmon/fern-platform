"use server";

import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { validateGitRepoAccess } from "@/app/services/dal/git/validateGitRepoAccess";
import { getDocsGitUrl } from "@/app/services/dal/github/getDocsGitUrl";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import { parseGitUrl } from "@/app/services/git-common/url-utils";
import type { DocsUrl } from "@/utils/types";

import { getGithubSourceMetadata } from "../getGithubSourceMetadata";
import { getGitlabSourceMetadata } from "../getGitlabSourceMetadata";

export type GitProvider = "github" | "gitlab";

export interface GetGitConnectionStatusRequest {
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
}

export interface GetGitConnectionStatusResponse {
    connected: boolean;
    provider?: GitProvider;
    gitUrl?: string;
    baseBranch?: string;
    owner?: string;
    repo?: string;
    error?: string;
}

export async function getGitConnectionStatus({
    docsUrl,
    orgName
}: GetGitConnectionStatusRequest): Promise<GetGitConnectionStatusResponse> {
    const session = await getCurrentSessionOrThrow();
    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    try {
        // Get the git URL for this docs site
        const gitUrlResult = await getDocsGitUrl(docsUrl, session.accessToken);

        if (!gitUrlResult.success) {
            return {
                connected: false,
                error: gitUrlResult.error.type
            };
        }

        const gitUrl = gitUrlResult.gitUrl;
        const parsed = parseGitUrl(gitUrl);

        if (!parsed.owner || !parsed.repo || parsed.provider === "unknown") {
            return {
                connected: false,
                error: "Invalid git URL format"
            };
        }

        const provider: GitProvider = parsed.provider;

        // Validate access to the repository
        const validation = await validateGitRepoAccess(orgName, docsUrl, gitUrl);

        if (!validation.ok) {
            return {
                connected: false,
                provider,
                gitUrl,
                error: validation.error?.type ?? "Validation failed"
            };
        }

        // Get source metadata to retrieve the base branch
        let baseBranch: string | undefined;
        let owner: string | undefined;
        let repo: string | undefined;

        if (provider === "gitlab") {
            const metadata = await getGitlabSourceMetadata({
                gitlabUrl: gitUrl,
                userId: session.user.sub
            });
            baseBranch = metadata.baseBranch;
            owner = metadata.owner;
            repo = metadata.repo;
        } else {
            const metadata = await getGithubSourceMetadata({
                githubUrl: gitUrl,
                userId: session.user.sub
            });
            baseBranch = metadata.baseBranch;
            owner = metadata.owner;
            repo = metadata.repo;
        }

        return {
            connected: true,
            provider,
            gitUrl,
            baseBranch: baseBranch ?? "main",
            owner,
            repo
        };
    } catch (error) {
        console.error("Failed to get git connection status:", error);
        return {
            connected: false,
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
}
