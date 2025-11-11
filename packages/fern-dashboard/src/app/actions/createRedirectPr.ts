"use server";

import yaml from "js-yaml";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { GithubCommitableFile } from "@/app/services/github/types";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { DocsUrl } from "@/utils/types";
import postCreatePr from "../api/post-git-create-pr/handler";
import type { Auth0OrgName } from "../services/auth0/types";
import createBranchIfNotExists from "../services/dal/github/createBranchIfNotExists";
import { withGithubAuth } from "../services/dal/github/middleware";
import postGitCommit from "../services/dal/github/postGitCommit";
import { getCachedGitHubLoader } from "../services/github/cachedGitHubLoader";

interface RedirectConfig {
    source: string;
    destination: string;
    permanent?: boolean;
}

interface DocsYmlConfig {
    redirects?: RedirectConfig[];
    [key: string]: unknown;
}

export async function createRedirectPrAction(
    orgName: Auth0OrgName,
    docsUrl: DocsUrl,
    githubUrl: string,
    sourcePath: string,
    destinationPath: string,
    baseBranch: string
): Promise<{
    success: boolean;
    error?: string;
    prUrl?: string;
    prNumber?: number;
}> {
    const session = await getCurrentSession();
    const site = parseDocsUrlParam({ docsUrl });
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
                const sanitizedPath = sourcePath
                    .replace(/^\//, "")
                    .replace(/\//g, "-")
                    .replace(/[^a-z0-9-]/gi, "")
                    .substring(0, 50);
                const timestamp = Date.now();
                const branchName = `fern/redirect-${sanitizedPath}-${timestamp}`;

                // Step 1: Create a new branch (only if it doesn't exist)
                const createBranchResult = await createBranchIfNotExists({
                    owner,
                    repo,
                    branch: branchName,
                    baseBranch,
                    site,
                    orgName
                });

                if (!createBranchResult.success) {
                    return {
                        success: false,
                        error: `Failed to create branch: ${createBranchResult.error}`
                    };
                }

                const githubLoader = await getCachedGitHubLoader(validatedGithubUrl);
                const docsYmlResult = await githubLoader.getDocsYml(owner, repo, site, baseBranch);

                if (docsYmlResult.type !== "ok") {
                    return { success: false, error: "Failed to fetch docs.yml" };
                }

                const docsYmlContent = docsYmlResult.result;

                // Parse YAML to check for existing redirect
                let docsConfig: DocsYmlConfig;
                try {
                    docsConfig = yaml.load(docsYmlContent) as DocsYmlConfig;
                } catch (error) {
                    return {
                        success: false,
                        error: `Failed to parse docs.yml: ${error instanceof Error ? error.message : "Unknown error"}`
                    };
                }

                // Check if redirect already exists
                const redirectExists = docsConfig.redirects?.some((redirect) => redirect.source === sourcePath);

                if (redirectExists) {
                    return {
                        success: false,
                        error: `A redirect for ${sourcePath} already exists`
                    };
                }

                // Manually insert redirect to preserve comments and formatting
                let updatedDocsYml: string;
                const newRedirect = `  - source: ${sourcePath}\n    destination: ${destinationPath}\n    permanent: true`;

                // Find the redirects section
                const redirectsMatch = docsYmlContent.match(/^redirects:\s*$/m);

                if (redirectsMatch?.index !== undefined) {
                    // Redirects section exists, add after it
                    const insertPosition = redirectsMatch.index + redirectsMatch[0].length;

                    // Check if there's already content after "redirects:"
                    const afterRedirects = docsYmlContent.substring(insertPosition);
                    const nextLineMatch = afterRedirects.match(/\n/);

                    if (nextLineMatch) {
                        const nextLinePos = insertPosition + (nextLineMatch.index ?? 0) + 1;
                        updatedDocsYml =
                            docsYmlContent.substring(0, nextLinePos) +
                            newRedirect +
                            "\n" +
                            docsYmlContent.substring(nextLinePos);
                    } else {
                        // End of file after redirects
                        updatedDocsYml = docsYmlContent + "\n" + newRedirect + "\n";
                    }
                } else {
                    // No redirects section, add it at the end
                    updatedDocsYml = docsYmlContent.trimEnd() + "\n\nredirects:\n" + newRedirect + "\n";
                }

                const projectResult = await githubLoader.getFernProjectBySite(owner, repo, site);
                if (projectResult.type !== "ok") {
                    return { success: false, error: "Failed to locate docs.yml path" };
                }

                const docsYmlPath = projectResult.result.project.docsYmlPath;

                const commitMessage = `Add redirect from ${sourcePath} to ${destinationPath}`;

                const files: GithubCommitableFile[] = [
                    {
                        path: docsYmlPath,
                        content: updatedDocsYml,
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
                    site
                });

                if (!commitResult.success) {
                    return {
                        success: false,
                        error: `Failed to commit changes: ${commitResult.error}`
                    };
                }

                const prTitle = `Add redirect for ${sourcePath}`;
                const prBody = `This PR adds a redirect from \`${sourcePath}\` to \`${destinationPath}\`.

🌿 _This PR was generated by Fern._
[(buildwithfern.com)](https://www.buildwithfern.com)`;

                const prResult = await postCreatePr({
                    owner,
                    repo,
                    head: branchName,
                    base: baseBranch,
                    title: prTitle,
                    body: prBody,
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
                console.error("Failed to create redirect PR", error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error occurred"
                };
            }
        }
    );
}
