import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { withGithubAuth } from "@/app/services/dal/github/middleware";
import type { GithubAuthContext } from "@/app/services/dal/github/types";
import { GithubIdentificationScheme } from "@/app/services/dal/github/types";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { ResolvedReturnType } from "@/utils/types";

import handler from "./handler";

export declare namespace postCreatePr {
  export type Request = z.infer<typeof PostCreatePrRequest>;
  export type Response = ResolvedReturnType<typeof handler>;
}

export const PostCreatePrRequest = GithubIdentificationScheme.and(
  z.object({
    head: z.string(),
    base: z.string(),
    title: z.string(),
    body: z.string().optional(),
    draft: z.boolean().optional(),
  })
);

export const POST = withZodValidation(
  PostCreatePrRequest,
  async (
    req: NextRequest,
    validatedBody: z.infer<typeof PostCreatePrRequest>
  ) =>
    withGithubAuth(
      async (_req: NextRequest, { repoData }: GithubAuthContext) => {
        const { head, base, title, body, draft } = validatedBody;
        const { owner, repo } = repoData;

        return NextResponse.json(
          await handler({
            owner,
            repo,
            head,
            base,
            title,
            body,
            draft,
          })
        );
      }
    )(req, validatedBody)
);
