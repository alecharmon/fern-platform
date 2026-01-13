import { type NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { maybeGetCurrentSession } from "@/app/api/utils/maybeGetCurrentSession";
import { orgNameValidator } from "@/app/api/utils/validators";
import { GithubIdentificationScheme } from "@/app/services/dal/github/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { parseGitUrl } from "@/app/services/git-common/url-utils";
import { getGitLoader } from "@/app/services/github/getGitLoader";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { ResolvedReturnType } from "@/utils/types";

import handler from "./handler";

export declare namespace postCreatePr {
    export type Request = z.infer<typeof PostCreatePrRequest>;
    export type Response = ResolvedReturnType<typeof handler>;
}

// Accept either a git URL or owner/repo pair, both with site
const GitRepoIdentification = z.union([
    z.object({ gitUrl: z.string(), site: z.string() }),
    z.object({ owner: z.string(), repo: z.string(), site: z.string() }),
    GithubIdentificationScheme // Keep backward compatibility (has site and githubUrl)
]);

export const PostCreatePrRequest = GitRepoIdentification.and(
    z.object({
        orgName: orgNameValidator,
        head: z.string(),
        base: z.string(),
        title: z.string(),
        body: z.string().optional(),
        draft: z.boolean().optional()
    })
);

export const POST = withZodValidation(
    PostCreatePrRequest,
    async (req: NextRequest, validatedBody: z.infer<typeof PostCreatePrRequest>) => {
        const { orgName, head, base, title, body, draft, ...repoData } = validatedBody;

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
            const isGitLab = parsed.provider === "gitlab";
            // For GitLab, use the full path; for GitHub, use repo
            const repoOrPath = isGitLab ? (parsed.path ?? parsed.repo) : parsed.repo;
            if (!parsed.owner || !repoOrPath) {
                return NextResponse.json({ error: "Invalid repository URL format" }, { status: 400 });
            }
            owner = parsed.owner;
            repo = repoOrPath;
        } else if ("githubUrl" in repoData) {
            // Backward compatibility
            gitUrl = repoData.githubUrl;
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
            // Default to GitHub for backward compatibility
            gitUrl = `https://github.com/${owner}/${repo}`;
        }

        // 4. Validate repository access (token/bot exists, org matches in fern.config.json)
        const loader = await getGitLoader(gitUrl);
        const site = parseDocsUrlParam({ docsUrl: siteRaw });
        const accessResult = await loader.validateAccess({
            owner,
            repo,
            site,
            orgName
        });

        if (accessResult?.type === "error") {
            console.error("[POST /api/post-git-create-pr] Access denied:", accessResult.error);
            return NextResponse.json({ error: `Access denied: ${accessResult.error.type}` }, { status: 403 });
        }

        // 5. Execute handler
        const result = await handler({
            owner,
            repo,
            head,
            base,
            title,
            body,
            draft,
            gitUrl
        });
        return NextResponse.json(result);
    }
);
