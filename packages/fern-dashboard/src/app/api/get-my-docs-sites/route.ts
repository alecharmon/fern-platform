import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { ResolvedReturnType } from "@/utils/types";

import { maybeGetCurrentSession } from "../utils/maybeGetCurrentSession";
import { parseNextRequestBody } from "../utils/parseNextRequestBody";
import { orgNameValidator } from "../utils/validators";
import handler from "./handler";

export declare namespace getMyDocsSites {
  export type Request = z.infer<typeof GetMyDocSitesRequest>;
  export type Response = ResolvedReturnType<typeof handler>;
}

const GetMyDocSitesRequest = z.object({
  orgName: orgNameValidator,
});

export async function POST(req: NextRequest) {
  const maybeSessionData = await maybeGetCurrentSession(req);
  if (maybeSessionData.errorResponse != null) {
    return maybeSessionData.errorResponse;
  }
  const { token } = maybeSessionData.data;

  const parsedBody = await parseNextRequestBody(req, GetMyDocSitesRequest);
  if (parsedBody.errorResponse != null) {
    return parsedBody.errorResponse;
  }
  const { orgName } = parsedBody.data;

  return NextResponse.json(await handler({ orgName, token }));
}
