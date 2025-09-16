import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { orgNameValidator } from "@/app/api/utils/validators";
import { withGithubAuthNextRoute } from "@/app/services/dal/github/middleware";
import { GithubIdentificationScheme } from "@/app/services/dal/github/types";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { ResolvedReturnType } from "@/utils/types";

import handler from "./handler";

export declare namespace getPrForBranch {
  export type Request = z.infer<typeof GetPrForBranchRequest>;
  export type Response = ResolvedReturnType<typeof handler>;
}

const GetPrForBranchRequest = GithubIdentificationScheme.and(
  z.object({
    orgName: orgNameValidator,
    branch: z.string(),
    baseBranch: z.string().optional(),
  })
);

export const POST = withZodValidation(
  GetPrForBranchRequest,
  async (
    req: NextRequest,
    validatedBody: z.infer<typeof GetPrForBranchRequest>
  ) => {
    const { orgName, branch, baseBranch, ...repoData } = validatedBody;

    return withGithubAuthNextRoute(
      req,
      orgName,
      repoData,
      async ({ owner, repo }) => {
        const result = await handler({
          owner,
          repo,
          branch,
          baseBranch,
        });
        return NextResponse.json(result);
      }
    );
  }
);
