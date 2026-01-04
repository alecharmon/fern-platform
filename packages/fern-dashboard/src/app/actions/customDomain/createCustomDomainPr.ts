"use server";

import yaml from "js-yaml";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getDomainWithoutSubpath, getSubpath, hasSubpath } from "@/app/services/domain";
import { parseGitUrl } from "@/app/services/git-common/url-utils";
import { getGitLoader } from "@/app/services/github/getGitLoader";
import type { GithubCommitableFile } from "@/app/services/github/types";
import { assertRateLimit, PR_CREATION_RATE_LIMIT, RateLimitError } from "@/app/services/rateLimit";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { DocsUrl } from "@/utils/types";
import postCreatePr from "../../api/post-git-create-pr/handler";
import type { Auth0OrgName } from "../../services/auth0/types";
import createBranchIfNotExists from "../../services/dal/github/createBranchIfNotExists";
import postGitCommit from "../../services/dal/github/postGitCommit";
import { assertUserHasOrganizationAccess } from "../../services/dal/organization";

export type GitProvider = "github" | "gitlab";

interface InstanceConfig {
    url?: string;
    "custom-domain"?: string | string[];
    [key: string]: unknown;
}

interface DocsYmlConfig {
    instances?: InstanceConfig[];
    [key: string]: unknown;
}

export interface CreateCustomDomainPrRequest {
    orgName: Auth0OrgName;
    docsUrl: DocsUrl;
    gitUrl: string;
    customDomain: string;
    baseBranch: string;
}

export interface CreateCustomDomainPrResponse {
    success: boolean;
    error?: string;
    prUrl?: string;
    prNumber?: number;
    provider?: GitProvider;
}

/**
 * Normalizes a URL by removing protocol and trailing slashes for comparison
 */
function normalizeUrl(url: string): string {
    return url
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "")
        .toLowerCase();
}

/**
 * Finds the line number where a specific instance starts in the docs.yml content
 */
function findInstanceLineIndex(content: string, instanceUrl: string): number {
    const lines = content.split("\n");
    const normalizedTarget = normalizeUrl(instanceUrl);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Look for lines that contain "url:" and match our target
        if (line && /^\s*-?\s*url:\s*/.test(line)) {
            // Extract the URL value from the line
            const urlMatch = line.match(/url:\s*(.+)/);
            if (urlMatch?.[1]) {
                const urlValue = urlMatch[1].trim().replace(/^["']|["']$/g, ""); // Remove quotes if present
                if (normalizeUrl(urlValue) === normalizedTarget) {
                    return i;
                }
            }
        }
    }

    return -1;
}

export async function createCustomDomainPr({
    orgName,
    docsUrl,
    gitUrl,
    customDomain,
    baseBranch
}: CreateCustomDomainPrRequest): Promise<CreateCustomDomainPrResponse> {
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

    // 2.5. Rate limit PR creation
    try {
        await assertRateLimit(orgName, "create-domain-pr", PR_CREATION_RATE_LIMIT);
    } catch (error) {
        if (error instanceof RateLimitError) {
            return { success: false, error: error.message };
        }
        throw error;
    }

    // 3. Extract owner/repo from git URL (supports both GitHub and GitLab)
    const parsed = parseGitUrl(gitUrl);
    const provider: GitProvider = parsed.provider === "gitlab" ? "gitlab" : "github";

    if (!parsed.owner || !parsed.repo) {
        return { success: false, error: `Invalid ${provider === "gitlab" ? "GitLab" : "GitHub"} URL` };
    }

    const owner = parsed.owner;
    // For GitLab, use the full path (includes nested groups); for GitHub, use repo
    const repo = provider === "gitlab" && parsed.path ? parsed.path : parsed.repo;

    // 4. Get GitLoader instance
    const loader = getGitLoader(gitUrl);

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
        const timestamp = Date.now();
        const branchName = `fern/custom-domain-${timestamp}`;

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

        // Parse YAML to find the matching instance
        let docsConfig: DocsYmlConfig;
        try {
            docsConfig = yaml.load(docsYmlContent) as DocsYmlConfig;
        } catch (error) {
            return {
                success: false,
                error: `Failed to parse docs.yml: ${error instanceof Error ? error.message : "Unknown error"}`
            };
        }

        if (!docsConfig.instances || docsConfig.instances.length === 0) {
            return {
                success: false,
                error: "No instances found in docs.yml"
            };
        }

        // Find the instance that matches the docsUrl
        const normalizedDocsUrl = normalizeUrl(site);
        const matchingInstance = docsConfig.instances.find((instance) => {
            if (!instance.url) {
                return false;
            }
            return normalizeUrl(instance.url) === normalizedDocsUrl;
        });

        if (!matchingInstance) {
            return {
                success: false,
                error: `Could not find instance matching ${site} in docs.yml`
            };
        }

        // Check if custom-domain already exists
        if (matchingInstance["custom-domain"]) {
            const existingDomain = matchingInstance["custom-domain"];
            const existingDomains = Array.isArray(existingDomain) ? existingDomain : [existingDomain];
            if (existingDomains.some((d) => normalizeUrl(d) === normalizeUrl(customDomain))) {
                return {
                    success: false,
                    error: `Custom domain ${customDomain} is already configured in docs.yml`
                };
            }
        }

        // Step 3: Manually insert custom-domain (and update url for subpaths) to preserve formatting
        let updatedDocsYml: string;
        const instanceLineIndex = findInstanceLineIndex(docsYmlContent, matchingInstance.url!);

        if (instanceLineIndex === -1) {
            return {
                success: false,
                error: "Could not locate instance in docs.yml for modification"
            };
        }

        const lines = docsYmlContent.split("\n");
        const urlLine = lines[instanceLineIndex];

        if (!urlLine) {
            return {
                success: false,
                error: "Could not read instance line from docs.yml"
            };
        }

        // Determine the indentation of the url line
        const indentMatch = urlLine.match(/^(\s*)/);
        const baseIndent = indentMatch ? indentMatch[1] : "    ";

        // Check if the url line starts with "- url:" (first instance in list) or just "url:"
        const isFirstInList = /^\s*-\s*url:/.test(urlLine);
        const propertyIndent = isFirstInList ? baseIndent + "  " : baseIndent;

        // Check if this is a subpath domain (e.g., example.com/docs)
        const isSubpathDomain = hasSubpath(customDomain);

        if (isSubpathDomain) {
            // For subpath domains, we need to:
            // 1. Update the URL to include the subpath
            // 2. Add custom-domain with the full domain+subpath
            const subpath = getSubpath(customDomain);

            // Update the URL line to include the subpath
            const urlMatch = urlLine.match(/(url:\s*)(.+)/);
            if (urlMatch) {
                const urlPrefix = urlLine.slice(0, urlLine.indexOf("url:")) + "url: ";
                const currentUrl = urlMatch[2]!.trim().replace(/^["']|["']$/g, "");
                const updatedUrl = currentUrl + subpath;
                lines[instanceLineIndex] = `${urlPrefix}${updatedUrl}`;
            }
        }

        // Create the custom-domain line
        const customDomainLine = `${propertyIndent}custom-domain: ${customDomain}`;

        // Insert the custom-domain line right after the url line
        lines.splice(instanceLineIndex + 1, 0, customDomainLine);
        updatedDocsYml = lines.join("\n");

        const projectResult = await loader.getFernProjectBySite(owner, repo, site);
        if (projectResult.type !== "ok") {
            return { success: false, error: "Failed to locate docs.yml path" };
        }

        const docsYmlPath = projectResult.result.project.docsYmlPath;

        const commitMessage = `Add custom domain ${customDomain}`;

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

        // Use appropriate terminology based on provider
        const prTerminology = provider === "gitlab" ? "MR" : "PR";
        const prFullTerminology = provider === "gitlab" ? "merge request" : "pull request";

        const prTitle = isSubpathDomain
            ? `Add custom domain with subpath: ${customDomain}`
            : `Add custom domain: ${customDomain}`;

        const prBody = isSubpathDomain
            ? `This ${prFullTerminology} adds a custom domain with subpath configuration to your documentation.

**Custom Domain:** \`${customDomain}\`

This ${prTerminology} updates both the \`url\` field (to include the subpath) and adds the \`custom-domain\` field.

## Next Steps

After merging this ${prFullTerminology}, you'll need to configure a reverse proxy on your server to forward requests to Fern.

**Proxy Configuration:**
- Point your proxy at \`https://${getDomainWithoutSubpath(customDomain)}\` to \`https://app.buildwithfern.com\`
- Add the header: \`X-Fern-Host: ${getDomainWithoutSubpath(customDomain)}\`

Your documentation will be accessible at \`https://${customDomain}\` once the proxy is configured.

---
_This ${prTerminology} was generated by Fern._
[(buildwithfern.com)](https://www.buildwithfern.com)`
            : `This ${prFullTerminology} adds a custom domain configuration to your documentation.

**Custom Domain:** \`${customDomain}\`

After this ${prFullTerminology} is merged and deployed, your documentation will be accessible at \`https://${customDomain}\`.

**Note:** You will also need to configure your DNS settings to point to Fern. See the dashboard for DNS configuration details.

---
_This ${prTerminology} was generated by Fern._
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
                error: `Failed to create ${prFullTerminology}: ${prResult.error}`
            };
        }

        return {
            success: true,
            prUrl: prResult.prUrl,
            prNumber: prResult.prNumber,
            provider
        };
    } catch (error) {
        console.error("Failed to create custom domain PR", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error occurred"
        };
    }
}
