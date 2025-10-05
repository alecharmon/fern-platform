import type { NextRequest } from "next/server";

import { extractOrgFromPreview } from "@fern-api/docs-utils";
import { COOKIE_FERN_TOKEN } from "@fern-api/docs-utils";

import { getDocsDomainEdge } from "../xfernhost/edge";
import { createGetAuthState } from "./getAuthState";

/**
 * @param request - the request to check the headers / cookies
 * @param pathname - the pathname to check the auth config against. The pathname MUST be provided in the middleware.
 */
export async function createGetAuthStateEdge(
    request: NextRequest,
    setFernToken?: (token: string) => void
): ReturnType<typeof createGetAuthState> {
    const domain = getDocsDomainEdge(request);
    const fern_token = request.headers.get("FERN_TOKEN") ?? request.cookies.get(COOKIE_FERN_TOKEN)?.value;

    // extract org from preview domain
    const org = extractOrgFromPreview(domain);
    const orgMetadata = org ? { org, isPreview: true } : undefined;

    return createGetAuthState(request.nextUrl.host, domain, fern_token, undefined, orgMetadata, setFernToken);
}
