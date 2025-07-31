import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { ResolvedReturnType } from "@/utils/types";

import { maybeGetCurrentSession } from "../utils/maybeGetCurrentSession";
import { parseNextRequestBody } from "../utils/parseNextRequestBody";
import { orgNameValidator } from "../utils/validators";
import handler from "./handler";

const GetGitHubPermissionsRequest = z.object({
  orgName: orgNameValidator,
});
export declare namespace getGitHubPermissions {
  export type Response = ResolvedReturnType<typeof handler>;
  export type Request = z.infer<typeof GetGitHubPermissionsRequest>;
}

export async function POST(req: NextRequest) {
  const maybeSessionData = await maybeGetCurrentSession(req);
  if (maybeSessionData.errorResponse != null) {
    return maybeSessionData.errorResponse;
  }
  const { userId } = maybeSessionData.data;

  const parsedBody = await parseNextRequestBody(
    req,
    GetGitHubPermissionsRequest
  );
  if (parsedBody.errorResponse != null) {
    return parsedBody.errorResponse;
  }
  const { orgName } = parsedBody.data;

  const response = await handler(userId, orgName);

  return NextResponse.json(response);
}
