import { type NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { maybeGetCurrentSession } from "@/app/api/utils/maybeGetCurrentSession";
import { orgNameValidator } from "@/app/api/utils/validators";
import { GitIdentificationScheme } from "@/app/services/dal/git/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { getGitLoader } from "@/app/services/github/getGitLoader";
import { getOwnerAndRepoFromGithubUrl } from "@/app/services/github/github";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { ResolvedReturnType } from "@/utils/types";

import handler from "./handler";

export declare namespace validateGithubBranch {
    export type Request = z.infer<typeof ValidateGithubBranchRequest>;
    export type Response = ResolvedReturnType<typeof handler>;
}

const ValidateGithubBranchRequest = GitIdentificationScheme.and(
    z.object({
        orgName: orgNameValidator,
        branchName: z.string()
    })
);

export const POST = withZodValidation(
    ValidateGithubBranchRequest,
    async (req: NextRequest, validatedBody: z.infer<typeof ValidateGithubBranchRequest>) => {
        const { orgName, branchName, ...repoData } = validatedBody;

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
        const site = parseDocsUrlParam({ docsUrl: repoData.site });

        if ("gitUrl" in repoData) {
            gitUrl = repoData.gitUrl;
            const parsed = getOwnerAndRepoFromGithubUrl(gitUrl);
            if (!parsed.owner || !parsed.repo) {
                return NextResponse.json({ error: "Invalid repository URL format" }, { status: 400 });
            }
            owner = parsed.owner;
            repo = parsed.repo;
        } else {
            owner = repoData.owner;
            repo = repoData.repo;
            gitUrl = `https://github.com/${owner}/${repo}`;
        }

        // 4. Get GitLoader and validate access
        const loader = getGitLoader(gitUrl);
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
        const response = await handler({ owner, repo, branchName });
        return NextResponse.json(response);
    }
);
