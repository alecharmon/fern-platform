import { type NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { maybeGetCurrentSession } from "@/app/api/utils/maybeGetCurrentSession";
import { orgNameValidator } from "@/app/api/utils/validators";
import { GitIdentificationScheme } from "@/app/services/dal/git/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { parseGitUrl } from "@/app/services/git-common/url-utils";
import type { ResolvedReturnType } from "@/utils/types";

import handler from "./handler";

export declare namespace generatePrDescription {
    export type Request = z.infer<typeof GeneratePrDescriptionRequest>;
    export type Response = ResolvedReturnType<typeof handler>;
}

// Accept either a git URL or owner/repo pair, both with site
const GitRepoIdentification = z.union([
    z.object({ gitUrl: z.string(), site: z.string() }),
    z.object({ owner: z.string(), repo: z.string(), site: z.string() }),
    GitIdentificationScheme // Keep backward compatibility (has site and gitUrl)
]);

export const GeneratePrDescriptionRequest = GitRepoIdentification.and(
    z.object({
        orgName: orgNameValidator,
        branch: z.string(),
        baseBranch: z.string().optional()
    })
);

export const POST = withZodValidation(
    GeneratePrDescriptionRequest,
    async (req: NextRequest, validatedBody: z.infer<typeof GeneratePrDescriptionRequest>) => {
        const { orgName, branch, baseBranch, ...repoData } = validatedBody;

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

        if ("gitUrl" in repoData) {
            gitUrl = repoData.gitUrl;
            const parsed = parseGitUrl(gitUrl);
            if (!parsed.owner || !parsed.repo) {
                return NextResponse.json({ error: "Invalid repository URL format" }, { status: 400 });
            }
            owner = parsed.owner;
            repo = parsed.repo;
        } else if ("gitUrl" in repoData) {
            // Backward compatibility
            gitUrl = repoData.gitUrl;
            const parsed = parseGitUrl(gitUrl);
            if (!parsed.owner || !parsed.repo) {
                return NextResponse.json({ error: "Invalid repository URL format" }, { status: 400 });
            }
            owner = parsed.owner;
            repo = parsed.repo;
        } else {
            owner = repoData.owner;
            repo = repoData.repo;
            // Default to GitHub for backward compatibility
            gitUrl = `https://github.com/${owner}/${repo}`;
        }

        // Note: We skip validateAccess here because:
        // 1. This is an optional enhancement feature (AI-generated descriptions)
        // 2. The handler already gracefully skips for non-GitHub repos
        // 3. User already passed validation to create the PR/MR

        // 4. Execute handler
        const result = await handler({ owner, repo, branch, baseBranch, gitUrl });
        return NextResponse.json(result);
    }
);
