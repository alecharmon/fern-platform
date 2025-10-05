import { type NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { orgNameValidator } from "@/app/api/utils/validators";
import { withGithubAuthNextRoute } from "@/app/services/dal/github/middleware";
import { GithubIdentificationScheme } from "@/app/services/dal/github/types";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { GitHubLoader } from "@/app/services/github/github-loader";

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

        return withGithubAuthNextRoute(req, orgName, repoData, async ({ owner, repo, site, githubUrl }) => {
            // Create GitHubLoader instance
            const gitLoader = new GitHubLoader(githubUrl);

            // Get the docs.yml file
            const docsYmlContent = await gitLoader.getDocsYml(owner, repo, site, branch);
            if (docsYmlContent.type !== "ok") {
                return NextResponse.json({ error: "Failed to fetch docs.yml" }, { status: 404 });
            }

            return NextResponse.json({
                success: true,
                docsYmlContent: docsYmlContent.result
            });
        });
    }
);
