import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { ResolvedReturnType } from "@/utils/types";

import { maybeGetCurrentSession } from "../utils/maybeGetCurrentSession";
import { parseNextRequestBody } from "../utils/parseNextRequestBody";
import { orgNameValidator } from "../utils/validators";
import handler from "./handler";

export declare namespace updatePrTitle {
  export type Request = z.infer<typeof UpdatePrTitleRequest>;
  export type Response = ResolvedReturnType<typeof handler>;
}

export const UpdatePrTitleRequest = z.object({
  owner: z.string(),
  repo: z.string(),
  branch: z.string(),
  title: z.string(),
  baseBranch: z.string().optional(),
  orgName: orgNameValidator,
});

export async function POST(req: NextRequest) {
  const maybeSessionData = await maybeGetCurrentSession(req);
  if (maybeSessionData.errorResponse != null) {
    return maybeSessionData.errorResponse;
  }
  const { userId } = maybeSessionData.data;
  const parsedBody = await parseNextRequestBody(req, UpdatePrTitleRequest);
  if (parsedBody.errorResponse != null) {
    return parsedBody.errorResponse;
  }
  const { owner, repo, branch, title, baseBranch, orgName } = parsedBody.data;

  return NextResponse.json(
    await handler(userId, orgName, {
      owner,
      repo,
      branch,
      title,
      baseBranch,
    })
  );
}
