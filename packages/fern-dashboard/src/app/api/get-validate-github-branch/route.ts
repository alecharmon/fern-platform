import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { orgNameValidator } from "@/app/api/utils/validators";
import { withGithubAuthNextRoute } from "@/app/services/dal/github/middleware";
import { GithubIdentificationScheme } from "@/app/services/dal/github/types";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { ResolvedReturnType } from "@/utils/types";

import handler from "./handler";

export declare namespace validateGithubBranch {
  export type Request = z.infer<typeof ValidateGithubBranchRequest>;
  export type Response = ResolvedReturnType<typeof handler>;
}

const ValidateGithubBranchRequest = GithubIdentificationScheme.and(
  z.object({
    orgName: orgNameValidator,
    branchName: z.string(),
  })
);

export const POST = withZodValidation(
  ValidateGithubBranchRequest,
  async (
    req: NextRequest,
    validatedBody: z.infer<typeof ValidateGithubBranchRequest>
  ) => {
    const { orgName, branchName, ...repoData } = validatedBody;

    return withGithubAuthNextRoute(
      req,
      orgName,
      repoData,
      async ({ owner, repo }) => {
        const response = await handler({ owner, repo, branchName });
        return NextResponse.json(response);
      }
    );
  }
);
