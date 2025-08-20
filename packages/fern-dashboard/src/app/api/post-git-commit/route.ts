import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { withGithubAuth } from "@/app/services/dal/github/middleware";
import {
  GithubAuthContext,
  GithubIdentificationScheme,
} from "@/app/services/dal/github/types";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { ResolvedReturnType } from "@/utils/types";

import handler from "./handler";

export declare namespace postGitCommit {
  export type Request = z.infer<typeof PostGitCommitRequest>;
  export type Response = ResolvedReturnType<typeof handler>;
}

export const PostGitCommitRequest = GithubIdentificationScheme.and(
  z.object({
    owner: z.string(),
    repo: z.string(),
    branch: z.string(),
    message: z.string(),
    files: z.array(
      z.discriminatedUnion("delete", [
        z.object({
          path: z.string(),
          delete: z.literal(true),
          // 100644 is normal file, 100755 is executable file, 040000 is directory, 160000 is symlink, 120000 is submodule
          mode: z
            .enum(["100644", "100755", "040000", "160000", "120000"])
            .optional(),
        }),
        z.object({
          path: z.string(),
          content: z.string(),
          // 100644 is normal file, 100755 is executable file, 040000 is directory, 160000 is symlink, 120000 is submodule
          mode: z
            .enum(["100644", "100755", "040000", "160000", "120000"])
            .optional(),
          delete: z.literal(false).optional(),
        }),
      ])
    ),
  })
);

export const POST = withZodValidation(
  PostGitCommitRequest,
  async (
    req: NextRequest,
    validatedBody: z.infer<typeof PostGitCommitRequest>
  ) =>
    withGithubAuth(
      async (_req: NextRequest, { repoData }: GithubAuthContext) => {
        const { branch, message, files } = validatedBody;
        const { owner, repo } = repoData;

        // Call the actual business logic handler
        return NextResponse.json(
          await handler({
            owner,
            repo,
            branch,
            message,
            files,
          })
        );
      }
    )(req, validatedBody)
);
