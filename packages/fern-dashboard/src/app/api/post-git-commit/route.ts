import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { ResolvedReturnType } from "@/utils/types";

import { maybeGetCurrentSession } from "../utils/maybeGetCurrentSession";
import { parseNextRequestBody } from "../utils/parseNextRequestBody";
import { orgNameValidator } from "../utils/validators";
import handler from "./handler";

export declare namespace postGitCommit {
  export type Request = z.infer<typeof PostGitCommitRequest>;
  export type Response = ResolvedReturnType<typeof handler>;
}

export const PostGitCommitRequest = z.object({
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
  orgName: orgNameValidator,
});

export async function POST(req: NextRequest) {
  const maybeSessionData = await maybeGetCurrentSession(req);
  if (maybeSessionData.errorResponse != null) {
    return maybeSessionData.errorResponse;
  }
  const { userId } = maybeSessionData.data;
  const parsedBody = await parseNextRequestBody(req, PostGitCommitRequest);
  if (parsedBody.errorResponse != null) {
    return parsedBody.errorResponse;
  }
  const { owner, repo, branch, message, files, orgName } = parsedBody.data;

  return NextResponse.json(
    await handler(userId, orgName, { owner, repo, branch, message, files })
  );
}
