import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { ResolvedReturnType } from "@/utils/types";
import { maybeGetCurrentSession } from "../utils/maybeGetCurrentSession";
import { parseNextRequestBody } from "../utils/parseNextRequestBody";
import handler from "./handler";

export declare namespace getDocsGitUrl {
    export type Request = z.infer<typeof getDocsGitUrlRequest>;
    export type Response = ResolvedReturnType<typeof handler>;
}

const getDocsGitUrlRequest = z.object({
    docsUrl: z.string()
});

export async function POST(req: NextRequest) {
    const maybeSessionData = await maybeGetCurrentSession(req);
    if (maybeSessionData.errorResponse != null) {
        return maybeSessionData.errorResponse;
    }
    const { token } = maybeSessionData.data;

    const parsedBody = await parseNextRequestBody(req, getDocsGitUrlRequest);
    if (parsedBody.errorResponse != null) {
        return parsedBody.errorResponse;
    }

    const response = await handler({
        docsUrl: parseDocsUrlParam({ docsUrl: parsedBody.data.docsUrl }),
        token
    });

    return NextResponse.json(response);
}
