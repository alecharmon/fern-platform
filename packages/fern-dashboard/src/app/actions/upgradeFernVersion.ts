"use server";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { GithubCommitableFile } from "@/app/services/github/types";
import type { DocsUrl } from "@/utils/types";

import postCreatePr from "../api/post-git-create-pr/handler";
import type { Auth0OrgName } from "../services/auth0/types";
import createBranchIfNotExists from "../services/dal/github/createBranchIfNotExists";
import { withGithubAuth } from "../services/dal/github/middleware";
import postGitCommit from "../services/dal/github/postGitCommit";
import { getUpgradePrBranchName } from "../services/dal/github/request-utils";
import { getCachedGitHubLoader } from "../services/github/cachedGitHubLoader";

export async function upgradeFernVersionAction(
    orgName: Auth0OrgName,
    docsUrl: DocsUrl,
    githubUrl: string,
    currentVersion: string,
    latestVersion: string,
    baseBranch: string
): Promise<{
    success: boolean;
    error?: string;
    prUrl?: string;
    prNumber?: number;
}> {
    const session = await getCurrentSession();
    if (session == null) {
        return { success: false, error: "No session found" };
    }

    return withGithubAuth(
        session.user.sub,
        session.accessToken,
        orgName,
        { site: docsUrl, githubUrl },
        async (authResult) => {
            if (!authResult.ok) {
                const { error } = authResult;
                let errorMessage: string;

                switch (error.type) {
                    case "ORG_ACCESS_ERROR":
                        errorMessage = "USER_NOT_IN_ORG";
                        break;
                    case "GITHUB_URL_ERROR":
                        errorMessage = "Invalid GitHub URL";
                        break;
                    case "GITHUB_ACCESS_ERROR":
                        errorMessage = `User does not have required GitHub access to perform this action: ${error.validationError.type}`;
                        break;
                    default:
                        errorMessage = error.message || "Unknown error occurred";
                }

                return { success: false, error: errorMessage };
            }

            const { owner, repo, githubUrl: validatedGithubUrl } = authResult.value;

            try {
                // Generate branch name
                const branchName = getUpgradePrBranchName(currentVersion, latestVersion);

                // Step 1: Create a new branch (only if it doesn't exist)
                const createBranchResult = await createBranchIfNotExists({
                    owner,
                    repo,
                    branch: branchName,
                    baseBranch,
                    site: docsUrl,
                    orgName
                });

                if (!createBranchResult.success) {
                    return {
                        success: false,
                        error: `Failed to create branch: ${createBranchResult.error}`
                    };
                }

                // Step 2: Get current fern.config.json content and update the version

                // Get current fern.config.json content
                const githubLoader = await getCachedGitHubLoader(validatedGithubUrl);
                const fernConfigResult = await githubLoader.getFernConfigJson(owner, repo, docsUrl);

                if (fernConfigResult.type !== "ok") {
                    return { success: false, error: fernConfigResult.error.type };
                }

                const { pathToFernConfigJson, ...fernConfig } = fernConfigResult.result;

                // Step 3: Commit the change (only if the content needs updating)
                const currentVersionInBranch = fernConfig.version;

                if (currentVersionInBranch !== latestVersion) {
                    // Update the version
                    fernConfig.version = latestVersion;
                    const updatedContent = JSON.stringify(fernConfig, null, 2);
                    const commitMessage = `Upgrade Fern CLI from ${currentVersion} to ${latestVersion}`;

                    const files: GithubCommitableFile[] = [
                        {
                            path: pathToFernConfigJson,
                            content: updatedContent,
                            mode: "100644"
                        }
                    ];

                    const commitResult = await postGitCommit({
                        owner,
                        repo,
                        branch: branchName,
                        message: commitMessage,
                        files,
                        orgName,
                        site: docsUrl
                    });

                    if (!commitResult.success) {
                        return {
                            success: false,
                            error: `Failed to commit changes: ${commitResult.error}`
                        };
                    }
                }

                // Step 4: Create a pull request
                const prResult = await postCreatePr({
                    owner,
                    repo,
                    head: branchName,
                    base: baseBranch,
                    title: `Upgrade Fern CLI to ${latestVersion}`,
                    body: `This PR upgrades the Fern CLI version from ${currentVersion} to ${latestVersion}.
        \n<br>
        \n🌿 _This PR was generated by Fern._
        [(buildwithfern.com)](https://www.buildwithfern.com)`,
                    draft: false
                });

                if (!prResult.success) {
                    return {
                        success: false,
                        error: `Failed to create pull request: ${prResult.error}`
                    };
                }

                return {
                    success: true,
                    prUrl: prResult.prUrl,
                    prNumber: prResult.prNumber
                };
            } catch (error) {
                console.error("Failed to upgrade Fern version", error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error occurred"
                };
            }
        }
    );
}
