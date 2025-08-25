import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { orgNameValidator } from "@/app/api/utils/validators";
import { withGithubAuth } from "@/app/services/dal/github/middleware";
import { GithubIdentificationScheme } from "@/app/services/dal/github/types";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { ResolvedReturnType } from "@/utils/types";

import handler from "./handler";

export declare namespace postCreateBranch {
  export type Request = z.infer<typeof PostCreateBranchRequest>;
  export type Response = ResolvedReturnType<typeof handler>;
}

export const PostCreateBranchRequest = GithubIdentificationScheme.and(
  z.object({
    orgName: orgNameValidator,
    branch: z.string(),
    baseBranch: z.string(),
  })
);

export const POST = withZodValidation(
  PostCreateBranchRequest,
  async (
    req: NextRequest,
    validatedBody: z.infer<typeof PostCreateBranchRequest>
  ) => {
    const { orgName, branch, baseBranch, ...repoData } = validatedBody;

    return withGithubAuth(req, orgName, repoData, async ({ owner, repo }) => {
      const result = await handler({ owner, repo, branch, baseBranch });
      return NextResponse.json(result);
    });
  }
);
