import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { withGithubAuth } from "@/app/services/dal/github/middleware";
import {
  GithubAuthContext,
  GithubIdentificationScheme,
} from "@/app/services/dal/github/types";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { GitHubLoader } from "@/app/services/github/github-loader";

const GetDocsYmlRequest = GithubIdentificationScheme.and(
  z.object({
    branch: z.string(),
  })
);

export const POST = withZodValidation(
  GetDocsYmlRequest,
  async (req: NextRequest, validatedBody: z.infer<typeof GetDocsYmlRequest>) =>
    withGithubAuth(
      async (_req: NextRequest, { repoData }: GithubAuthContext) => {
        const { branch } = validatedBody;
        const { owner, repo } = repoData;

        // Create GitHubLoader instance
        const gitLoader = new GitHubLoader(repoData.githubUrl);

        // Get the docs.yml file
        const docsYmlContent = await gitLoader.getDocsYml(owner, repo, branch);
        if (!docsYmlContent) {
          return NextResponse.json(
            { error: "Failed to fetch docs.yml" },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          docsYmlContent,
        });
      }
    )(req, validatedBody)
);
