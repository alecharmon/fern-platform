import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { ResolvedReturnType } from "@/utils/types";

import { maybeGetCurrentSession } from "../utils/maybeGetCurrentSession";
import { parseNextRequestBody } from "../utils/parseNextRequestBody";
import handler from "./handler";

export declare namespace preloadEditorData {
    export type Request = z.infer<typeof PostPreloadEditorData>;
    export type Response = ResolvedReturnType<typeof handler>;
}

const PostPreloadEditorData = z.object({
    docsUrl: z.string()
});

export async function POST(req: NextRequest) {
    const maybeSessionData = await maybeGetCurrentSession(req);
    if (maybeSessionData.errorResponse != null) {
        return maybeSessionData.errorResponse;
    }
    const parsedBody = await parseNextRequestBody(req, PostPreloadEditorData);
    if (parsedBody.errorResponse != null) {
        return parsedBody.errorResponse;
    }
    const { docsUrl } = parsedBody.data;

    const host = req.headers.get("host") ?? "";

    return NextResponse.json(await handler({ docsUrl, host }));
}
