import { type NextRequest, NextResponse } from "next/server";

import { z } from "zod";
import { getDocsGithubMetadata } from "@/app/actions/getDocsGithubMetadata";
import { maybeGetCurrentSession } from "@/app/api/utils/maybeGetCurrentSession";
import { orgNameValidator } from "@/app/api/utils/validators";
import { GitIdentificationScheme } from "@/app/services/dal/git/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { parseGitUrl } from "@/app/services/git-common/url-utils";
import { getGitLoader } from "@/app/services/github/getGitLoader";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { ResolvedReturnType } from "@/utils/types";

import handler from "./handler";

export declare namespace updatePrTitle {
    export type Request = z.infer<typeof UpdatePrTitleRequest>;
    export type Response = ResolvedReturnType<typeof handler>;
}

// Accept either a git URL or owner/repo pair, both with site
const GitRepoIdentification = z.union([
    z.object({ gitUrl: z.string(), site: z.string() }),
    z.object({ owner: z.string(), repo: z.string(), site: z.string() }),
    GitIdentificationScheme // Keep backward compatibility (has site and gitUrl)
]);

export const UpdatePrTitleRequest = GitRepoIdentification.and(
    z.object({
        orgName: orgNameValidator,
        branch: z.string(),
        title: z.string(),
        baseBranch: z.string().optional()
    })
);

export const POST = withZodValidation(
    UpdatePrTitleRequest,
    async (req: NextRequest, validatedBody: z.infer<typeof UpdatePrTitleRequest>) => {
        const { orgName, branch, title, baseBranch, ...repoData } = validatedBody;

        // 1. Validate session
        const sessionResult = await maybeGetCurrentSession(req);
        if (sessionResult.errorResponse != null) {
            return sessionResult.errorResponse;
        }

        // 2. Validate org membership
        try {
            await assertUserHasOrganizationAccess(sessionResult.data.token, orgName);
        } catch (_error) {
            return NextResponse.json({ error: "User is not a member of the specified organization" }, { status: 403 });
        }

        // 3. Parse repo data
        let owner: string;
        let repo: string;
        let gitUrl: string;
        let siteRaw: string;

        if ("gitUrl" in repoData) {
            gitUrl = repoData.gitUrl;
            siteRaw = repoData.site;
            const parsed = parseGitUrl(gitUrl);
            if (!parsed.owner || !parsed.repo) {
                return NextResponse.json({ error: "Invalid repository URL format" }, { status: 400 });
            }
            owner = parsed.owner;
            repo = parsed.repo;
        } else {
            owner = repoData.owner;
            repo = repoData.repo;
            siteRaw = repoData.site;

            // Look up the git URL from the docs site metadata
            console.log("[POST /api/update-pr-title] Looking up git URL for site:", siteRaw);
            const site = parseDocsUrlParam({ docsUrl: siteRaw });
            const metadata = await getDocsGithubMetadata(site);
            if (!metadata.success || !metadata.gitUrl) {
                console.error("[POST /api/update-pr-title] No git URL found for site:", siteRaw, metadata);
                return NextResponse.json(
                    { error: "Could not determine repository URL for this site" },
                    { status: 400 }
                );
            }
            gitUrl = metadata.gitUrl;
            console.log("[POST /api/update-pr-title] Resolved git URL from metadata:", gitUrl);
        }

        // 4. Get GitLoader and validate access
        console.log("[POST /api/update-pr-title] Using gitUrl:", gitUrl);
        const loader = getGitLoader(gitUrl);
        const site = parseDocsUrlParam({ docsUrl: siteRaw });

        console.log("[POST /api/update-pr-title] Validating access for:", { owner, repo, site, orgName });
        const accessResult = await loader.validateAccess?.({
            owner,
            repo,
            site,
            orgName
        });

        console.log("[POST /api/update-pr-title] Access validation result:", accessResult);

        if (accessResult?.type === "error") {
            console.error("[POST /api/update-pr-title] Access denied:", accessResult.error);
            return NextResponse.json({ error: `Access denied: ${accessResult.error.type}` }, { status: 403 });
        }

        // 5. Execute handler
        const result = await handler({
            owner,
            repo,
            branch,
            title,
            baseBranch,
            gitUrl
        });
        return NextResponse.json(result);
    }
);
