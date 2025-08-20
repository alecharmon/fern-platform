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

export declare namespace updatePrStatus {
  export type Request = z.infer<typeof UpdatePrStatusRequest>;
  export type Response = ResolvedReturnType<typeof handler>;
}

export const UpdatePrStatusRequest = GithubIdentificationScheme.and(
  z.object({
    branch: z.string(),
    status: z.enum(["open", "draft"]),
    baseBranch: z.string().optional(),
  })
);

export const POST = withZodValidation(
  UpdatePrStatusRequest,
  async (
    req: NextRequest,
    validatedBody: z.infer<typeof UpdatePrStatusRequest>
  ) =>
    withGithubAuth(
      async (_req: NextRequest, { repoData }: GithubAuthContext) => {
        const { branch, status, baseBranch } = validatedBody;
        const { owner, repo } = repoData;

        return NextResponse.json(
          await handler({
            owner,
            repo,
            branch,
            status,
            baseBranch,
          })
        );
      }
    )(req, validatedBody)
);
