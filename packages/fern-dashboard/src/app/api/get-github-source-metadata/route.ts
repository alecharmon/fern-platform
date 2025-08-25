import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { orgNameValidator } from "@/app/api/utils/validators";
import { withGithubAuth } from "@/app/services/dal/github/middleware";
import { GithubIdentificationScheme } from "@/app/services/dal/github/types";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { ResolvedReturnType } from "@/utils/types";

import handler from "./handler";

export declare namespace getGithubSourceMetadata {
  export type Request = z.infer<typeof GetGithubSourceMetadataRequest>;
  export type Response = ResolvedReturnType<typeof handler>;
}

const GetGithubSourceMetadataRequest = GithubIdentificationScheme.and(
  z.object({
    orgName: orgNameValidator,
    skipCache: z.boolean().optional(),
  })
);

export const POST = withZodValidation(
  GetGithubSourceMetadataRequest,
  async (
    req: NextRequest,
    validatedBody: z.infer<typeof GetGithubSourceMetadataRequest>
  ) => {
    const { orgName, skipCache, ...repoData } = validatedBody;

    return withGithubAuth(req, orgName, repoData, async ({ githubUrl }) => {
      const { maybeGetCurrentSession } = await import(
        "@/app/api/utils/maybeGetCurrentSession"
      );
      const sessionResult = await maybeGetCurrentSession(req);
      if (sessionResult.errorResponse != null) {
        return sessionResult.errorResponse;
      }
      const { userId } = sessionResult.data;

      const response = await handler({ userId, githubUrl, skipCache });
      return NextResponse.json(response);
    });
  }
);
