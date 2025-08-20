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

export declare namespace getPrForBranch {
  export type Request = z.infer<typeof GetPrForBranchRequest>;
  export type Response = ResolvedReturnType<typeof handler>;
}

export const GetPrForBranchRequest = GithubIdentificationScheme.and(
  z.object({
    branch: z.string(),
    baseBranch: z.string().optional(),
  })
);

export const POST = withZodValidation(
  GetPrForBranchRequest,
  async (
    req: NextRequest,
    validatedBody: z.infer<typeof GetPrForBranchRequest>
  ) =>
    withGithubAuth(
      async (_req: NextRequest, { repoData }: GithubAuthContext) => {
        const { branch, baseBranch } = validatedBody;
        const { owner, repo } = repoData;

        return NextResponse.json(
          await handler({
            owner,
            repo,
            branch,
            baseBranch,
          })
        );
      }
    )(req, validatedBody)
);
