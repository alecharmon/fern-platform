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

const GetDocsYmlRequest = GithubIdentificationScheme.and(
    z.object({
        orgName: orgNameValidator,
        branch: z.string()
    })
);

export const POST = withZodValidation(
    GetDocsYmlRequest,
    async (req: NextRequest, validatedBody: z.infer<typeof GetDocsYmlRequest>) => {
        const { orgName, branch, ...repoData } = validatedBody;

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
                return NextResponse.json({ error: "Invalid GitHub URL format" }, { status: 400 });
            }
            owner = parsed.owner;
            repo = parsed.repo;
        } else {
            owner = repoData.owner;
            repo = repoData.repo;
            githubUrl = `https://github.com/${owner}/${repo}`;
        }

        // 4. Get GitLoader and validate access
        const loader = await getGitLoader(githubUrl);
        const accessResult = await loader.validateAccess({
            owner,
            repo,
            site,
            orgName
        });

        if (accessResult?.type === "error") {
            return NextResponse.json({ error: `Access denied: ${accessResult.error.type}` }, { status: 403 });
        }

        // 5. Get the docs.yml file
        const docsYmlContent = await loader.getDocsYml(owner, repo, site, branch);
        if (docsYmlContent.type !== "ok") {
            return NextResponse.json({ error: "Failed to fetch docs.yml" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            docsYmlContent: docsYmlContent.result
        });
    }
);
