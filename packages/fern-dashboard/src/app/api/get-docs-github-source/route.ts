import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { ResolvedReturnType } from "@/utils/types";

import { maybeGetCurrentSession } from "../utils/maybeGetCurrentSession";
import { parseNextRequestBody } from "../utils/parseNextRequestBody";
import handler from "./handler";

export declare namespace getDocsGithubSource {
  export type Request = z.infer<typeof GetDocsGithubSourceRequest>;
  export type Response = ResolvedReturnType<typeof handler>;
}

const GetDocsGithubSourceRequest = z.object({
  url: z.string(),
  skipCache: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const maybeSessionData = await maybeGetCurrentSession(req);
  if (maybeSessionData.errorResponse != null) {
    return maybeSessionData.errorResponse;
  }
  const { token, userId } = maybeSessionData.data;

  const parsedBody = await parseNextRequestBody(
    req,
    GetDocsGithubSourceRequest
  );
  if (parsedBody.errorResponse != null) {
    return parsedBody.errorResponse;
  }
  const { url, skipCache } = parsedBody.data;

  const response = await handler({ token, url, userId, skipCache });

  // TODO: we should check if the user has access to the github repo
  // if (response.url != null) {
  //   const doesUserHaveAccessToUrl = await auth0Management.doesUserBelongsToOrg(
  //     userId,
  //     response.url
  //   );
  //   if (!doesUserBelongToOrg) {
  //     response = { url: undefined };
  //   }
  // }

  return NextResponse.json(response);
}
