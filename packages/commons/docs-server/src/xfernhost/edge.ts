import type { NextRequest } from "next/server";

import { COOKIE_FERN_DOCS_PREVIEW, HEADER_X_FERN_HOST } from "@fern-api/docs-utils";

import { getNextPublicDocsDomain } from "./dev";
import { cleanHost } from "./util";

/**
 * Note: x-fern-host is always appended to the request header by cloudfront for all *.docs.buildwithfern.com requests.
 */
export function getDocsDomainEdge(req: NextRequest): string {
    // transfer x-fern-host query parameter to header
    if (req.nextUrl.searchParams.has(HEADER_X_FERN_HOST)) {
        const fernHostValue = req.nextUrl.searchParams.get(HEADER_X_FERN_HOST);
        if (fernHostValue) {
            req.headers.set(HEADER_X_FERN_HOST, fernHostValue);
            req.nextUrl.searchParams.delete(HEADER_X_FERN_HOST);
        }
    }

    const hosts = [
        getNextPublicDocsDomain(),
        req.cookies.get(COOKIE_FERN_DOCS_PREVIEW)?.value,
        req.headers.get(HEADER_X_FERN_HOST),
        req.nextUrl.host
    ];

    for (let host of hosts) {
        host = cleanHost(host);
        if (host != null) {
            return host;
        }
    }

    console.error("Could not determine xFernHost from request. Returning buildwithfern.com.");
    return "buildwithfern.com";
}
