import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { ResolvedReturnType } from "@/utils/types";

import { maybeGetCurrentSession } from "../utils/maybeGetCurrentSession";
import { parseNextRequestBody } from "../utils/parseNextRequestBody";
import { orgNameValidator } from "../utils/validators";
import handler from "./handler";

export declare namespace generatePrDescription {
  export type Request = z.infer<typeof GeneratePrDescriptionRequest>;
  export type Response = ResolvedReturnType<typeof handler>;
}

export const GeneratePrDescriptionRequest = z.object({
  owner: z.string(),
  repo: z.string(),
  branch: z.string(),
  baseBranch: z.string().optional(),
  orgName: orgNameValidator,
});

export async function POST(req: NextRequest) {
  const maybeSessionData = await maybeGetCurrentSession(req);
  if (maybeSessionData.errorResponse != null) {
    return maybeSessionData.errorResponse;
  }
  const { userId } = maybeSessionData.data;
  const parsedBody = await parseNextRequestBody(
    req,
    GeneratePrDescriptionRequest
  );
  if (parsedBody.errorResponse != null) {
    return parsedBody.errorResponse;
  }
  const { owner, repo, branch, baseBranch, orgName } = parsedBody.data;

  return NextResponse.json(
    await handler(userId, orgName, { owner, repo, branch, baseBranch })
  );
}
