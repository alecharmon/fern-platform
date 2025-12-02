import { type NextRequest, NextResponse } from "next/server";

import { z } from "zod";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { ResolvedReturnType } from "@/utils/types";
import { maybeGetCurrentSession } from "../utils/maybeGetCurrentSession";
import { parseNextRequestBody } from "../utils/parseNextRequestBody";
import handler from "./handler";

export declare namespace ValidateGithubRepoAccess {
    export type Request = z.infer<typeof ValidateGithubRepoAccessRequest>;
    export type Response = ResolvedReturnType<typeof handler>;
}

const ValidateGithubRepoAccessRequest = z.object({
    url: z.string(),
    owner: z.string(),
    repo: z.string()
});

export async function POST(req: NextRequest) {
    const maybeSessionData = await maybeGetCurrentSession(req);
    if (maybeSessionData.errorResponse != null) {
        return maybeSessionData.errorResponse;
    }
    const { token } = maybeSessionData.data;

    const parsedBody = await parseNextRequestBody(req, ValidateGithubRepoAccessRequest);
    if (parsedBody.errorResponse != null) {
        return parsedBody.errorResponse;
    }
    const { url, owner, repo } = parsedBody.data;

    const response = await handler({ url: parseDocsUrlParam({ docsUrl: url }), token, owner, repo });
    return NextResponse.json(response);
}
