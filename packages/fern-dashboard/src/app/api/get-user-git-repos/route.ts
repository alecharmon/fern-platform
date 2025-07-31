import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { Auth0OrgName } from "@/app/services/auth0/types";
import { ResolvedReturnType } from "@/utils/types";

import { maybeGetCurrentSession } from "../utils/maybeGetCurrentSession";
import { parseNextRequestBody } from "../utils/parseNextRequestBody";
import { orgNameValidator } from "../utils/validators";
import handler from "./handler";

const GetUserGithubReposRequest = z.object({
  page: z.number().optional().default(1),
  orgName: orgNameValidator,
});

export declare namespace getUserGithubRepos {
  export type Response = ResolvedReturnType<typeof handler>;
  export type Request = z.infer<typeof GetUserGithubReposRequest>;
}

export async function POST(req: NextRequest) {
  const maybeSessionData = await maybeGetCurrentSession(req);
  if (maybeSessionData.errorResponse != null) {
    return maybeSessionData.errorResponse;
  }
  const { userId } = maybeSessionData.data;

  const parsedBody = await parseNextRequestBody(req, GetUserGithubReposRequest);
  if (parsedBody.errorResponse != null) {
    return parsedBody.errorResponse;
  }
  const { orgName, page } = parsedBody.data;

  // Validate parameters
  if (isNaN(page) || page < 1) {
    return NextResponse.json(
      { error: "Invalid page parameter. Must be a positive integer." },
      { status: 400 }
    );
  }
  if (!orgName) {
    return NextResponse.json(
      { error: "orgName parameter is required." },
      { status: 400 }
    );
  }

  return NextResponse.json(await handler(userId, Auth0OrgName(orgName), page));
}
