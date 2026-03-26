import { type NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { ResolvedReturnType } from "@/utils/types";

import { maybeGetCurrentSession } from "../utils/maybeGetCurrentSession";
import { parseNextRequestBody } from "../utils/parseNextRequestBody";
import handler from "./handler";

export declare namespace ValidateGitRepo {
    export type Request = z.infer<typeof ValidateGitRepoRequest>;
    export type Response = ResolvedReturnType<typeof handler>;
}

const ValidateGitRepoRequest = z.object({
    url: z.string(),
    gitUrl: z.string(),
    forceRefresh: z.boolean().optional()
});

export async function POST(req: NextRequest) {
    const maybeSessionData = await maybeGetCurrentSession(req);
    if (maybeSessionData.errorResponse != null) {
        return maybeSessionData.errorResponse;
    }
    const { token } = maybeSessionData.data;

    const parsedBody = await parseNextRequestBody(req, ValidateGitRepoRequest);
    if (parsedBody.errorResponse != null) {
        return parsedBody.errorResponse;
    }
    const { url, gitUrl, forceRefresh } = parsedBody.data;

    const response = await handler({
        url: parseDocsUrlParam({ docsUrl: url }),
        token,
        gitUrl,
        forceRefresh
    });
    return NextResponse.json(response);
}
