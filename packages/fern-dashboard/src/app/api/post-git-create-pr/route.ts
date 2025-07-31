import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { ResolvedReturnType } from "@/utils/types";

import { maybeGetCurrentSession } from "../utils/maybeGetCurrentSession";
import { parseNextRequestBody } from "../utils/parseNextRequestBody";
import { orgNameValidator } from "../utils/validators";
import handler from "./handler";

export declare namespace postCreatePr {
  export type Request = z.infer<typeof PostCreatePrRequest>;
  export type Response = ResolvedReturnType<typeof handler>;
}

export const PostCreatePrRequest = z.object({
  owner: z.string(),
  repo: z.string(),
  head: z.string(),
  base: z.string(),
  title: z.string(),
  body: z.string().optional(),
  draft: z.boolean().optional(),
  orgName: orgNameValidator,
});

export async function POST(req: NextRequest) {
  const maybeSessionData = await maybeGetCurrentSession(req);
  if (maybeSessionData.errorResponse != null) {
    return maybeSessionData.errorResponse;
  }
  const { userId } = maybeSessionData.data;
  const parsedBody = await parseNextRequestBody(req, PostCreatePrRequest);
  if (parsedBody.errorResponse != null) {
    return parsedBody.errorResponse;
  }
  const { owner, repo, head, base, title, body, draft, orgName } =
    parsedBody.data;

  return NextResponse.json(
    await handler(userId, orgName, {
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
