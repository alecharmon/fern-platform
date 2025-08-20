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

export declare namespace updatePrTitle {
  export type Request = z.infer<typeof UpdatePrTitleRequest>;
  export type Response = ResolvedReturnType<typeof handler>;
}

export const UpdatePrTitleRequest = GithubIdentificationScheme.and(
  z.object({
    branch: z.string(),
    title: z.string(),
    baseBranch: z.string().optional(),
  })
);

export const POST = withZodValidation(
  UpdatePrTitleRequest,
  async (
    req: NextRequest,
    validatedBody: z.infer<typeof UpdatePrTitleRequest>
  ) =>
    withGithubAuth(
      async (_req: NextRequest, { repoData }: GithubAuthContext) => {
        const { branch, title, baseBranch } = validatedBody;
        const { owner, repo } = repoData;

        return NextResponse.json(
          await handler({
            owner,
            repo,
            branch,
            title,
            baseBranch,
          })
        );
      }
    )(req, validatedBody)
);
