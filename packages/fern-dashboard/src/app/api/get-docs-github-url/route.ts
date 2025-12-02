import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import type { ResolvedReturnType } from "@/utils/types";

import { maybeGetCurrentSession } from "../utils/maybeGetCurrentSession";
import { parseNextRequestBody } from "../utils/parseNextRequestBody";
import handler from "./handler";

export declare namespace getDocsGithubUrl {
    export type Request = z.infer<typeof GetDocsGithubUrlRequest>;
    export type Response = ResolvedReturnType<typeof handler>;
}

const GetDocsGithubUrlRequest = z.object({
    docsUrl: z.string()
});

export async function POST(req: NextRequest) {
    const maybeSessionData = await maybeGetCurrentSession(req);
    if (maybeSessionData.errorResponse != null) {
        return maybeSessionData.errorResponse;
    }
    const { token } = maybeSessionData.data;

    const parsedBody = await parseNextRequestBody(req, GetDocsGithubUrlRequest);
    if (parsedBody.errorResponse != null) {
        return parsedBody.errorResponse;
    }

    const response = await handler({
        docsUrl: parsedBody.data.docsUrl,
        token
    });

    return NextResponse.json(response);
}
