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

export declare namespace getGithubSourceMetadata {
  export type Request = z.infer<typeof GetGithubSourceMetadataRequest>;
  export type Response = ResolvedReturnType<typeof handler>;
}

const GetGithubSourceMetadataRequest = GithubIdentificationScheme.and(
  z.object({
    skipCache: z.boolean().optional(),
  })
);

export const POST = withZodValidation(
  GetGithubSourceMetadataRequest,
  async (
    req: NextRequest,
    validatedBody: z.infer<typeof GetGithubSourceMetadataRequest>
  ) =>
    withGithubAuth(
      async (_req: NextRequest, { userId, repoData }: GithubAuthContext) => {
        const { skipCache } = validatedBody;
        const { githubUrl } = repoData;

        const response = await handler({ userId, githubUrl, skipCache });
        return NextResponse.json(response);
      }
    )(req, validatedBody)
);
