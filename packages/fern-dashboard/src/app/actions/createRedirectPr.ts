"use server";

import yaml from "js-yaml";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getGitLoader } from "@/app/services/github/getGitLoader";
import type { GithubCommitableFile } from "@/app/services/github/types";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { DocsUrl } from "@/utils/types";
import postCreatePr from "../api/post-git-create-pr/handler";
import type { Auth0OrgName } from "../services/auth0/types";
import createBranchIfNotExists from "../services/dal/github/createBranchIfNotExists";
import postGitCommit from "../services/dal/github/postGitCommit";
import { assertUserHasOrganizationAccess } from "../services/dal/organization";

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
    // 1. Check user session
    const session = await getCurrentSession();
    const site = parseDocsUrlParam({ docsUrl });
    if (session == null) {
        return { success: false, error: "No session found" };
    }

    // 2. Check org membership
    try {
        await assertUserHasOrganizationAccess(session.accessToken, orgName);
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "User is not a member of the organization"
        };
    }

    // 3. Extract owner/repo from githubUrl
    const urlMatch = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!urlMatch) {
        return { success: false, error: "Invalid GitHub URL" };
    }
    const owner = urlMatch[1];
    const repo = urlMatch[2]?.replace(/\.git$/, "");

    if (!owner || !repo) {
        return { success: false, error: "Invalid GitHub URL" };
    }

    // 4. Get GitLoader instance
    const loader = getGitLoader(githubUrl);

    // 5. Validate repository access
    const accessResult = await loader.validateAccess({
        owner,
        repo,
        site: docsUrl,
        orgName
    });

    if (accessResult?.type === "error") {
        return { success: false, error: `Access validation failed: ${accessResult.error.type}` };
    }

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

        // Step 2: Get docs.yml content
        const docsYmlResult = await loader.getDocsYml(owner, repo, site, baseBranch);

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

        const projectResult = await loader.getFernProjectBySite(owner, repo, site);
        if (projectResult.type !== "ok") {
            return { success: false, error: "Failed to locate docs.yml path" };
        }

        const docsYmlPath = projectResult.result.project.docsYmlPath;

        const commitMessage = `Add redirect from ${sourcePath} to ${destinationPath}`;

        const files: GithubCommitableFile[] = [
            {
                path: docsYmlPath,
                content: updatedDocsYml
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
