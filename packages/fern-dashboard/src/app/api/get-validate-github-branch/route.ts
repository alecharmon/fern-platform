import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { withGithubAuth } from "@/app/services/dal/github/middleware";
import {
  type GithubAuthContext,
  GithubIdentificationScheme,
} from "@/app/services/dal/github/types";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { ResolvedReturnType } from "@/utils/types";

import handler from "./handler";

export declare namespace validateGithubBranch {
  export type Request = z.infer<typeof ValidateGithubBranchRequest>;
  export type Response = ResolvedReturnType<typeof handler>;
}

const ValidateGithubBranchRequest = GithubIdentificationScheme.and(
  z.object({
    branchName: z.string(),
  })
);

export const POST = withZodValidation(
  ValidateGithubBranchRequest,
  async (
    req: NextRequest,
    validatedBody: z.infer<typeof ValidateGithubBranchRequest>
  ) =>
    withGithubAuth(
      async (_req: NextRequest, { repoData }: GithubAuthContext) => {
        const { branchName } = validatedBody;
        const { owner, repo } = repoData;

        const response = await handler({ owner, repo, branchName });
        return NextResponse.json(response);
      }
    )(req, validatedBody)
);
