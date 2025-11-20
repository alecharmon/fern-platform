import { type NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { maybeGetCurrentSession } from "@/app/api/utils/maybeGetCurrentSession";
import { orgNameValidator } from "@/app/api/utils/validators";
import { GithubIdentificationScheme } from "@/app/services/dal/github/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { getGitLoader } from "@/app/services/github/getGitLoader";
import { getOwnerAndRepoFromGithubUrl } from "@/app/services/github/github";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { ResolvedReturnType } from "@/utils/types";

import handler from "./handler";

export declare namespace postCreatePr {
    export type Request = z.infer<typeof PostCreatePrRequest>;
    export type Response = ResolvedReturnType<typeof handler>;
}

export const PostCreatePrRequest = GithubIdentificationScheme.and(
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
        let githubUrl: string;
        const site = parseDocsUrlParam({ docsUrl: repoData.site });

        if ("githubUrl" in repoData) {
            githubUrl = repoData.githubUrl;
            const parsed = getOwnerAndRepoFromGithubUrl(githubUrl);
            if (!parsed.owner || !parsed.repo) {
                return NextResponse.json({ error: "Invalid repository URL format" }, { status: 400 });
            }
            owner = parsed.owner;
            repo = parsed.repo;
        } else {
            owner = repoData.owner;
            repo = repoData.repo;
            githubUrl = `https://github.com/${owner}/${repo}`;
        }

        // 4. Get GitLoader and validate access
        const loader = getGitLoader(githubUrl);
        const accessResult = await loader.validateAccess?.({
            owner,
            repo,
            site,
            orgName
        });

        if (accessResult?.type === "error") {
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
            draft
        });
        return NextResponse.json(result);
    }
);
