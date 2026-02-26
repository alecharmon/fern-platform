import { NextResponse } from "next/server";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getVenusClient } from "@/app/services/venus/getVenusClient";
import type { DocsUrl } from "@/utils/types";
import { getDocsUrlOwner } from "../utils/getDocsUrlMetadata";
import type { MaybeErrorResponse } from "../utils/MaybeErrorResponse";

export async function ensureUserOwnsUrl(params: { token: string; url: DocsUrl }): Promise<MaybeErrorResponse> {
    const { token, url } = params;

    let owner: { orgName: Auth0OrgName };
    try {
        owner = await getDocsUrlOwner({ url, token });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to resolve docs URL owner for ${url}:`, message);
        return {
            errorResponse: NextResponse.json({ error: `Failed to resolve docs URL owner: ${message}` }, { status: 502 })
        };
    }

    let isMember: Awaited<ReturnType<ReturnType<typeof getVenusClient>["organization"]["isMember"]>>;
    try {
        isMember = await getVenusClient({ token }).organization.isMember(owner.orgName);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Failed to check org membership:", message);
        return {
            errorResponse: NextResponse.json({ error: `Failed to check org membership: ${message}` }, { status: 502 })
        };
    }

    if (!isMember.ok) {
        console.error("Failed to load org membership for user", JSON.stringify(isMember.error));
        return {
            errorResponse: NextResponse.json({ error: "Failed to load org membership for user" }, { status: 502 })
        };
    }
    if (!isMember.body) {
        return {
            errorResponse: NextResponse.json({ error: "User does not have access to url" }, { status: 403 })
        };
    }

    return { data: undefined };
}

export async function ensureOrgOwnsUrl(params: {
    token: string;
    url: DocsUrl;
    orgName: Auth0OrgName;
}): Promise<MaybeErrorResponse> {
    const { token, url, orgName } = params;

    let owner: { orgName: Auth0OrgName };
    try {
        owner = await getDocsUrlOwner({ url, token });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to resolve docs URL owner for ${url}:`, message);
        return {
            errorResponse: NextResponse.json({ error: `Failed to resolve docs URL owner: ${message}` }, { status: 502 })
        };
    }

    if (owner.orgName !== orgName) {
        console.error(`Org ${orgName} does not own URL ${url} (it is owned by ${owner.orgName})`);
        return {
            errorResponse: NextResponse.json({ message: `Org ${orgName} does not own URL ${url}` }, { status: 401 })
        };
    }
    return { data: undefined };
}
